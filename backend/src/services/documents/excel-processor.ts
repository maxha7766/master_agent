/**
 * Excel Documentation Processor
 * Complete pipeline for processing Excel documentation into RAG-ready chunks
 */

import { WebDocScraper, type ScrapedDocument } from './web-scraper.js';
import { ExcelChunker, type ExcelChunk } from './excel-chunker.js';
import { ExcelMetadataExtractor } from './excel-metadata-extractor.js';
import { EmbeddingService } from './embedding.js';
import { log } from '../../lib/logger.js';
import type { ExcelDocSource } from '../../config/excel-sources.js';
import type { ExcelChunkMetadata } from './excel-metadata-types.js';

export interface ProcessedChunk {
  content: string;
  embedding: number[];
  metadata: ExcelChunkMetadata;
  tokens: number;
}

export interface ProcessingResult {
  sourceId: string;
  sourceName: string;
  chunks: ProcessedChunk[];
  totalChunks: number;
  totalTokens: number;
  processingTimeMs: number;
  errors: string[];
}

export interface ProcessingOptions {
  // Chunking options
  targetTokens?: number;
  overlapTokens?: number;
  preserveCodeBlocks?: boolean;

  // Metadata extraction
  extractMetadata?: boolean;
  metadataBatchSize?: number;

  // Embedding generation
  generateEmbeddings?: boolean;
  embeddingBatchSize?: number;

  // Rate limiting
  delayBetweenBatches?: number;
}

export class ExcelDocumentProcessor {
  private scraper: WebDocScraper;
  private chunker: ExcelChunker;
  private metadataExtractor: ExcelMetadataExtractor;
  private embeddingService: EmbeddingService;

  constructor() {
    this.scraper = new WebDocScraper();
    this.chunker = new ExcelChunker();
    this.metadataExtractor = new ExcelMetadataExtractor();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Process a single Excel documentation source end-to-end
   */
  async processSource(
    source: ExcelDocSource,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    log.info('Starting Excel source processing', {
      sourceId: source.id,
      sourceName: source.name,
    });

    try {
      // Step 1: Scrape documentation
      const scrapedDocs = await this.scrapeSource(source);

      if (scrapedDocs.size === 0) {
        throw new Error('Failed to scrape any content from source');
      }

      // Step 2: Process all scraped documents (may be multiple if segmented)
      const allChunks: ProcessedChunk[] = [];

      for (const [docId, doc] of scrapedDocs.entries()) {
        try {
          const chunks = await this.processDocument(doc, options);
          allChunks.push(...chunks);

          log.info('Document processed', {
            docId,
            chunks: chunks.length,
          });
        } catch (error) {
          const errorMsg = `Failed to process document ${docId}: ${error instanceof Error ? error.message : String(error)}`;
          log.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const processingTimeMs = Date.now() - startTime;
      const totalTokens = allChunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

      log.info('Excel source processing complete', {
        sourceId: source.id,
        totalChunks: allChunks.length,
        totalTokens,
        processingTimeMs,
        errors: errors.length,
      });

      return {
        sourceId: source.id,
        sourceName: source.name,
        chunks: allChunks,
        totalChunks: allChunks.length,
        totalTokens,
        processingTimeMs,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Excel source processing failed', {
        sourceId: source.id,
        error: errorMsg,
      });

      throw new Error(`Failed to process source ${source.id}: ${errorMsg}`);
    }
  }

  /**
   * Process multiple sources in batch
   */
  async processBatch(
    sources: ExcelDocSource[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    log.info('Starting batch Excel processing', {
      sourceCount: sources.length,
    });

    for (const source of sources) {
      try {
        const result = await this.processSource(source, options);
        results.push(result);

        // Rate limiting between sources
        if (options.delayBetweenBatches) {
          await this.delay(options.delayBetweenBatches);
        }
      } catch (error) {
        log.error('Failed to process source in batch', {
          sourceId: source.id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Continue processing other sources even if one fails
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          chunks: [],
          totalChunks: 0,
          totalTokens: 0,
          processingTimeMs: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    const totalChunks = results.reduce((sum, r) => sum + r.totalChunks, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
    const successfulSources = results.filter((r) => r.errors.length === 0).length;

    log.info('Batch Excel processing complete', {
      totalSources: sources.length,
      successfulSources,
      totalChunks,
      totalTokens,
    });

    return results;
  }

  /**
   * Scrape documentation source (handles single page vs segmented)
   */
  private async scrapeSource(
    source: ExcelDocSource
  ): Promise<Map<string, ScrapedDocument>> {
    log.info('Scraping Excel source', {
      sourceId: source.id,
      strategy: source.metadata.scraping_strategy,
    });

    if (source.metadata.scraping_strategy === 'single_page_segmented') {
      return await this.scraper.scrapeAndSegmentByCategory(source);
    } else {
      const doc = await this.scraper.scrapeDocPage(source);
      const results = new Map<string, ScrapedDocument>();
      if (doc) {
        results.set(source.id, doc);
      }
      return results;
    }
  }

  /**
   * Process a scraped document into chunks with metadata and embeddings
   */
  private async processDocument(
    doc: ScrapedDocument,
    options: ProcessingOptions
  ): Promise<ProcessedChunk[]> {
    const {
      targetTokens = 600,
      overlapTokens = 100,
      preserveCodeBlocks = true,
      extractMetadata = true,
      metadataBatchSize = 5,
      generateEmbeddings = true,
      embeddingBatchSize = 50,
      delayBetweenBatches = 1000,
    } = options;

    // Step 1: Chunk the document
    log.info('Chunking document', {
      title: doc.title,
      contentLength: doc.content.length,
    });

    const chunks = await this.chunker.chunkDocument(
      doc.content,
      {
        ...doc.sourceMetadata,
        source_url: doc.url,
      },
      {
        targetTokens,
        overlapTokens,
        preserveCodeBlocks,
      }
    );

    log.info('Document chunked', {
      title: doc.title,
      chunks: chunks.length,
    });

    // Step 2: Extract metadata for each chunk
    let enrichedChunks: ExcelChunk[] = chunks;

    if (extractMetadata) {
      log.info('Extracting metadata', {
        chunks: chunks.length,
        batchSize: metadataBatchSize,
      });

      const metadataPromises = chunks.map((chunk) =>
        this.metadataExtractor.extractExcelMetadata(chunk.content, chunk.metadata)
      );

      // Process metadata extraction in batches to avoid rate limits
      const enrichedMetadata: ExcelChunkMetadata[] = [];

      for (let i = 0; i < metadataPromises.length; i += metadataBatchSize) {
        const batch = metadataPromises.slice(i, i + metadataBatchSize);
        const batchResults = await Promise.all(batch);
        enrichedMetadata.push(...batchResults);

        if (i + metadataBatchSize < metadataPromises.length) {
          await this.delay(delayBetweenBatches);
        }
      }

      enrichedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        metadata: enrichedMetadata[index],
      }));

      log.info('Metadata extraction complete', {
        chunks: enrichedChunks.length,
      });
    }

    // Step 3: Generate embeddings
    const processedChunks: ProcessedChunk[] = [];

    if (generateEmbeddings) {
      log.info('Generating embeddings', {
        chunks: enrichedChunks.length,
        batchSize: embeddingBatchSize,
      });

      const contents = enrichedChunks.map((chunk) => chunk.content);
      const embeddings = await this.embeddingService.generateBatch(contents, {
        batchSize: embeddingBatchSize,
      });

      for (let i = 0; i < enrichedChunks.length; i++) {
        processedChunks.push({
          content: enrichedChunks[i].content,
          embedding: embeddings[i],
          metadata: enrichedChunks[i].metadata,
          tokens: enrichedChunks[i].tokens,
        });
      }

      log.info('Embeddings generated', {
        chunks: processedChunks.length,
      });
    } else {
      // No embeddings requested, return chunks without embeddings
      for (const chunk of enrichedChunks) {
        processedChunks.push({
          content: chunk.content,
          embedding: [],
          metadata: chunk.metadata,
          tokens: chunk.tokens,
        });
      }
    }

    return processedChunks;
  }

  /**
   * Validate processed chunks before database insertion
   */
  validateChunks(chunks: ProcessedChunk[]): { valid: ProcessedChunk[]; invalid: number } {
    const valid: ProcessedChunk[] = [];
    let invalid = 0;

    for (const chunk of chunks) {
      // Check required fields
      if (!chunk.content || chunk.content.trim().length < 50) {
        invalid++;
        continue;
      }

      // Check embedding dimensions if present
      if (chunk.embedding.length > 0 && chunk.embedding.length !== 1536) {
        log.warn('Invalid embedding dimensions', {
          expected: 1536,
          actual: chunk.embedding.length,
        });
        invalid++;
        continue;
      }

      // Check metadata
      if (!chunk.metadata.source_type || !chunk.metadata.doc_category) {
        invalid++;
        continue;
      }

      valid.push(chunk);
    }

    if (invalid > 0) {
      log.warn('Some chunks failed validation', {
        valid: valid.length,
        invalid,
      });
    }

    return { valid, invalid };
  }

  /**
   * Generate summary statistics for processed chunks
   */
  generateStats(results: ProcessingResult[]): ProcessingStats {
    const totalSources = results.length;
    const successfulSources = results.filter((r) => r.errors.length === 0).length;
    const failedSources = totalSources - successfulSources;
    const totalChunks = results.reduce((sum, r) => sum + r.totalChunks, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTimeMs, 0);

    // Calculate function coverage
    const functionNames = new Set<string>();
    const categories = new Set<string>();

    for (const result of results) {
      for (const chunk of result.chunks) {
        if (chunk.metadata.function_name) {
          functionNames.add(chunk.metadata.function_name);
        }
        if (chunk.metadata.function_category) {
          categories.add(chunk.metadata.function_category);
        }
      }
    }

    return {
      totalSources,
      successfulSources,
      failedSources,
      totalChunks,
      totalTokens,
      averageChunksPerSource: Math.round(totalChunks / successfulSources),
      averageTokensPerChunk: Math.round(totalTokens / totalChunks),
      totalProcessingTimeMs: totalProcessingTime,
      uniqueFunctions: functionNames.size,
      uniqueCategories: categories.size,
    };
  }

  /**
   * Helper: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export interface ProcessingStats {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalChunks: number;
  totalTokens: number;
  averageChunksPerSource: number;
  averageTokensPerChunk: number;
  totalProcessingTimeMs: number;
  uniqueFunctions: number;
  uniqueCategories: number;
}
