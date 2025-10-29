/**
 * Document Processing Service
 * Handles text extraction, chunking, and embedding generation
 */

import { log } from '../../lib/logger.js';
import { embeddingsService } from '../embeddings/openai.js';
import { supabase } from '../../models/database.js';
import { metadataExtractor } from './metadata.js';

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  startChar?: number;
  endChar?: number;
  tokenCount: number;
}

export interface ProcessingResult {
  documentId: string;
  chunks: number;
  tokens: number;
  cost: number;
  summary?: string;
}

export interface ChunkMetadata {
  document_type?: string;
  tags?: string[];
  entity_names?: string[];
  summary?: string;
  file_name?: string;
  file_type?: string;
}

export class DocumentProcessor {
  private readonly CHUNK_SIZE = 500; // tokens per chunk
  private readonly CHUNK_OVERLAP = 50; // overlap tokens

  /**
   * Update processing progress
   */
  private async updateProgress(
    documentId: string,
    step: string,
    percent: number,
    message: string
  ): Promise<void> {
    await supabase
      .from('documents')
      .update({
        processing_progress: {
          step,
          percent,
          message,
        },
      })
      .eq('id', documentId);

    log.info('Progress updated', { documentId, step, percent, message });
  }

  /**
   * Process uploaded document: extract text, chunk, generate embeddings, store
   */
  async processDocument(
    documentId: string,
    userId: string,
    content: string,
    fileName: string = 'document.txt'
  ): Promise<ProcessingResult> {
    try {
      // Update status to processing
      await supabase
        .from('documents')
        .update({
          status: 'processing',
          processing_progress: {
            step: 'starting',
            percent: 5,
            message: 'Starting document processing...',
          },
        })
        .eq('id', documentId);

      log.info('Starting document processing', {
        documentId,
        userId,
        contentLength: content.length,
      });

      // Extract metadata using LLM
      await this.updateProgress(documentId, 'metadata', 15, 'Extracting document metadata...');
      log.info('Extracting metadata', { documentId });
      const extractedMetadata = await metadataExtractor.extractMetadata(
        content,
        fileName
      );

      // Split into chunks
      await this.updateProgress(documentId, 'chunking', 35, 'Splitting document into chunks...');
      const chunks = this.chunkText(content);

      log.info('Text chunked', {
        documentId,
        chunkCount: chunks.length,
      });

      // Generate embeddings for all chunks
      await this.updateProgress(documentId, 'embeddings', 50, `Generating embeddings for ${chunks.length} chunks...`);
      const embeddings = await this.generateEmbeddings(chunks, documentId);

      log.info('Embeddings generated', {
        documentId,
        embeddingCount: embeddings.length,
      });

      // Store chunks with metadata in database
      await this.updateProgress(documentId, 'storing', 85, 'Storing chunks in database...');
      await this.storeChunks(
        documentId,
        userId,
        chunks,
        embeddings,
        extractedMetadata,
        fileName
      );

      // Update document status with summary
      await this.updateProgress(documentId, 'finalizing', 95, 'Finalizing...');
      const { data: updateData, error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'completed',
          chunk_count: chunks.length,
          summary: extractedMetadata.summary,
          processing_progress: {
            step: 'completed',
            percent: 100,
            message: 'Document processing complete',
          },
        })
        .eq('id', documentId);

      if (updateError) {
        log.error('Failed to update document status to completed', {
          documentId,
          error: updateError.message,
        });
        throw new Error(`Failed to update document status: ${updateError.message}`);
      }

      log.info('Document status updated to completed', {
        documentId,
        chunkCount: chunks.length,
      });

      const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const cost = embeddingsService.calculateCost(totalTokens);

      log.info('Document processing complete', {
        documentId,
        chunks: chunks.length,
        tokens: totalTokens,
        cost,
        summary: extractedMetadata.summary?.substring(0, 100),
      });

      return {
        documentId,
        chunks: chunks.length,
        tokens: totalTokens,
        cost,
        summary: extractedMetadata.summary,
      };
    } catch (error) {
      log.error('Document processing failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Update document status to failed
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          processing_progress: {
            step: 'failed',
            percent: 0,
            message: error instanceof Error ? error.message : 'Processing failed',
          },
        })
        .eq('id', documentId);

      throw error;
    }
  }

  /**
   * Chunk text into segments with overlap
   */
  private chunkText(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Simple sentence-based chunking
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    let startChar = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokens + sentenceTokens > this.CHUNK_SIZE && currentChunk) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          startChar,
          endChar: startChar + currentChunk.length,
          tokenCount: currentTokens,
        });

        // Start new chunk with overlap
        const overlapSentences = currentChunk.split(/[.!?]+/).slice(-2).join('.');
        currentChunk = overlapSentences + ' ' + sentence;
        currentTokens = this.estimateTokens(currentChunk);
        startChar += currentChunk.length - currentChunk.length;
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        startChar,
        endChar: startChar + currentChunk.length,
        tokenCount: currentTokens,
      });
    }

    return chunks;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate embeddings for all chunks
   */
  private async generateEmbeddings(
    chunks: DocumentChunk[],
    documentId?: string
  ): Promise<number[][]> {
    const texts = chunks.map((c) => c.content);

    // Batch embeddings in groups of 100 (OpenAI limit is 2048)
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const results = await embeddingsService.embedBatch(batch);
      embeddings.push(...results.map((r) => r.embedding));

      // Update progress during embedding generation
      if (documentId && chunks.length > batchSize) {
        const progressPercent = 50 + Math.floor((i / texts.length) * 30);
        await this.updateProgress(
          documentId,
          'embeddings',
          progressPercent,
          `Generating embeddings... ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
        );
      }
    }

    return embeddings;
  }

  /**
   * Store chunks with embeddings and metadata in database
   */
  private async storeChunks(
    documentId: string,
    userId: string,
    chunks: DocumentChunk[],
    embeddings: number[][],
    extractedMetadata: any,
    fileName: string
  ): Promise<void> {
    const records = chunks.map((chunk, i) => ({
      document_id: documentId,
      user_id: userId,
      content: chunk.content,
      embedding: embeddings[i], // Pass array directly - Supabase handles pgvector conversion
      chunk_index: chunk.chunkIndex,
      position: i, // Position in document
      page_number: chunk.pageNumber,
      start_char: chunk.startChar,
      end_char: chunk.endChar,
      token_count: chunk.tokenCount,
      metadata: {
        document_type: extractedMetadata.document_type,
        tags: extractedMetadata.tags || [],
        entity_names: extractedMetadata.entity_names || [],
        summary: extractedMetadata.summary,
        file_name: fileName,
      },
    }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase.from('chunks').insert(batch);

      if (error) {
        throw new Error(`Failed to store chunks: ${error.message}`);
      }
    }
  }

  /**
   * Extract text from file based on type
   */
  async extractText(filePath: string, fileType: string): Promise<string> {
    // For now, support only plain text files
    // TODO: Add PDF, DOCX, etc. extraction using libraries
    if (fileType === 'text/plain' || fileType === 'txt') {
      const fs = await import('fs');
      return fs.promises.readFile(filePath, 'utf-8');
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// Singleton instance
export const documentProcessor = new DocumentProcessor();
