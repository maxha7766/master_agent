/**
 * RAG Agent
 * Retrieval Augmented Generation for document-aware responses
 */

import { vectorSearchService, SearchResult } from '../../services/rag/search.js';
import { documentStorageService } from '../../services/documents/storage.js';
import { LLMFactory } from '../../services/llm/factory.js';
import { log } from '../../lib/logger.js';

export interface RAGOptions {
  topK?: number;
  minRelevanceScore?: number;
  model?: string;
  temperature?: number;
  includeSources?: boolean;
  ragOnlyMode?: boolean;
}

export interface RAGResponse {
  content: string;
  sources: Array<{
    documentId: string;
    fileName: string;
    chunkIndex: number;
    pageNumber?: number;
    relevanceScore: number;
    excerpt: string;
  }>;
  metadata: {
    chunksRetrieved: number;
    model: string;
    tokensUsed?: number;
    latencyMs: number;
  };
}

export class RAGAgent {

  /**
   * Generate response with document context
   */
  async generateResponse(
    query: string,
    userId: string,
    options: RAGOptions = {}
  ): Promise<RAGResponse> {
    const startTime = Date.now();

    const {
      topK = 5,
      minRelevanceScore = 0.0,
      model = 'claude-sonnet-4-5-20250929',
      temperature = 0.7,
      includeSources = true,
      ragOnlyMode = false,
    } = options;

    try {
      console.log('\n========== RAG AGENT: GENERATE RESPONSE ==========');
      console.log('Options received:', options);

      const llm = LLMFactory.getProvider(model);
      const isLongContextModel = model.includes('gemini');

      let context = '';
      let searchResults: SearchResult[] = [];
      let sourcesForResponse: any[] = [];

      if (isLongContextModel) {
        // --- HYBRID RAG FLOW (Gemini 1.5 Pro) ---
        log.info('🚀 RAG AGENT: Using Hybrid Long-Context Flow', { model });

        // 1. Find relevant documents (Document Discovery)
        const docIds = await vectorSearchService.findRelevantDocuments(query, userId, 3); // Limit to top 3 docs

        if (docIds.length > 0) {
          // 2. Hydrate full text
          const docMap = await documentStorageService.getMultipleDocuments(docIds, userId);

          // 3. Build Context from full documents
          context = Array.from(docMap.entries())
            .map(([id, text], i) => `[Document ${i + 1}] (ID: ${id}):\n${text}`)
            .join('\n\n');

          // Create dummy search results for source attribution (since we don't have chunks)
          // We'll need to fetch metadata to make this look nice, but for now use IDs
          sourcesForResponse = docIds.map(id => ({
            documentId: id,
            fileName: 'Full Document', // We could fetch real names if needed
            chunkIndex: 0,
            relevanceScore: 1.0,
            excerpt: 'Full document used for context.'
          }));

          log.info('✅ RAG AGENT: Full documents hydrated', { count: docIds.length });
        } else {
          context = 'No relevant documents found.';
        }

      } else {
        // --- STANDARD RAG FLOW (Chunk-based) ---
        log.info('Standard RAG query started', { query, userId, topK });

        // 1. Retrieve relevant chunks
        searchResults = await vectorSearchService.search(query, userId, {
          topK,
          minRelevanceScore,
        });

        // 2. Build context from chunks
        context = this.buildContext(searchResults);

        sourcesForResponse = searchResults.map((r) => ({
          documentId: r.documentId,
          fileName: r.fileName || 'Unknown',
          chunkIndex: r.chunkIndex || 0,
          pageNumber: r.pageNumber,
          relevanceScore: r.relevanceScore,
          excerpt: this.createExcerpt(r.content, 150),
        }));
      }

      // Step 3: Generate response with LLM
      const systemPrompt = this.buildSystemPrompt(includeSources, ragOnlyMode);
      const userPrompt = this.buildUserPrompt(query, context);

      const llmResponse = await llm.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model,
        { temperature }
      );

      const latencyMs = Date.now() - startTime;

      log.info('RAG response generated', {
        userId,
        model,
        tokensUsed: llmResponse.tokensUsed,
        latencyMs,
      });

      return {
        content: llmResponse.content,
        sources: sourcesForResponse,
        metadata: {
          chunksRetrieved: isLongContextModel ? sourcesForResponse.length : searchResults.length,
          model,
          tokensUsed: typeof llmResponse.tokensUsed === 'number' ? llmResponse.tokensUsed : llmResponse.tokensUsed?.total || 0,
          latencyMs,
        },
      };
    } catch (error) {
      log.error('RAG generation failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Stream response with document context
   */
  async *generateStreamingResponse(
    query: string,
    userId: string,
    options: RAGOptions = {}
  ): AsyncGenerator<string, RAGResponse, unknown> {
    const {
      topK = 5,
      minRelevanceScore = 0.0,
      model = 'claude-sonnet-4-5-20250929',
      temperature = 0.7,
      includeSources = true,
    } = options;

    const llm = LLMFactory.getProvider(model);
    const isLongContextModel = model.includes('gemini-1.5-pro');

    let context = '';
    let searchResults: SearchResult[] = [];
    let sourcesForResponse: any[] = [];

    if (isLongContextModel) {
      // --- HYBRID RAG FLOW ---
      const docIds = await vectorSearchService.findRelevantDocuments(query, userId, 3);
      if (docIds.length > 0) {
        const docMap = await documentStorageService.getMultipleDocuments(docIds, userId);
        context = Array.from(docMap.entries())
          .map(([id, text], i) => `[Document ${i + 1}]:\n${text}`)
          .join('\n\n');

        sourcesForResponse = docIds.map(id => ({
          documentId: id,
          fileName: 'Full Document',
          chunkIndex: 0,
          relevanceScore: 1.0,
          excerpt: 'Full document used.'
        }));
      } else {
        context = 'No relevant documents found.';
      }
    } else {
      // --- STANDARD RAG FLOW ---
      searchResults = await vectorSearchService.search(query, userId, {
        topK,
        minRelevanceScore,
      });
      context = this.buildContext(searchResults);
      sourcesForResponse = searchResults.map((r) => ({
        documentId: r.documentId,
        fileName: r.fileName || 'Unknown',
        chunkIndex: r.chunkIndex || 0,
        pageNumber: r.pageNumber,
        relevanceScore: r.relevanceScore,
        excerpt: this.createExcerpt(r.content, 150),
      }));
    }

    const systemPrompt = this.buildSystemPrompt(includeSources, false);
    const userPrompt = this.buildUserPrompt(query, context);

    let fullContent = '';
    let tokensUsed = 0;
    const startTime = Date.now();

    for await (const chunk of llm.chatStream(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model,
      { temperature }
    )) {
      if ('content' in chunk) {
        fullContent += chunk.content;
        yield chunk.content;
      }
      if ('tokensUsed' in chunk && chunk.tokensUsed) {
        tokensUsed = typeof chunk.tokensUsed === 'number' ? chunk.tokensUsed : (chunk.tokensUsed as any)?.total || 0;
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      content: fullContent,
      sources: sourcesForResponse,
      metadata: {
        chunksRetrieved: sourcesForResponse.length,
        model,
        tokensUsed,
        latencyMs,
      },
    };
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant documents found.';
    }

    return results
      .map((r, i) => {
        const source = r.fileName
          ? `${r.fileName}${r.pageNumber ? ` (page ${r.pageNumber})` : ''}`
          : 'Document';

        return `[${i + 1}] From ${source}:\n${r.content}`;
      })
      .join('\n\n');
  }

  /**
   * Build system prompt for RAG
   */
  private buildSystemPrompt(includeSources: boolean, ragOnlyMode: boolean): string {
    const basePrompt = ragOnlyMode
      ? `You are a helpful and friendly AI assistant. Your goal is to have a natural, engaging conversation with the user about their documents.
IMPORTANT: You can ONLY answer using information from the provided context. Do not use any general knowledge outside of what's in the documents.`
      : `You are a helpful and friendly AI assistant. Your goal is to have a natural, engaging conversation with the user about their documents.`;

    const guidelines = `
Guidelines:
1. **Be Personable**: Write like a human, not a robot. Use a warm, conversational tone.
2. **Avoid Robotic Phrases**: NEVER say "According to the document", "Based on the context", or "The text states". Just say it! (e.g., instead of "The document says the project is due Friday", say "It looks like the project is due Friday").
3. **Flow Naturally**: Weave facts into sentences. You can use lists if they help clarity, but introduce them naturally.
4. **Be Direct but Polite**: Answer the question directly, but maintain a friendly vibe.
5. **Context is Key**: If the context doesn't have the answer, say something like "I couldn't find that specific detail in your docs" rather than a robotic "Information not found".`;

    if (includeSources) {
      return basePrompt + guidelines + `\n6. **Sources**: When you mention specific facts, you can lightly reference sources (e.g., [Source 1]) if needed for credibility, but don't let it break the flow.`;
    }

    return basePrompt + guidelines;
  }

  /**
   * Build user prompt with query and context
   */
  private buildUserPrompt(query: string, context: string): string {
    return `${query}

Context from your documents:
${context}`;
  }

  /**
   * Create excerpt from text
   */
  private createExcerpt(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Retrieve context chunks WITHOUT generating a response
   */
  async retrieveContext(
    query: string,
    userId: string,
    options: { topK?: number; minRelevanceScore?: number; ragOnlyMode?: boolean } = {}
  ): Promise<SearchResult[]> {
    // This method is primarily for the Master Agent to get chunks.
    // For now, we'll stick to the standard chunk search here as the Master Agent
    // likely expects chunks, not full documents.
    const { topK = 5, minRelevanceScore = 0.0 } = options;

    try {
      return await vectorSearchService.search(query, userId, {
        topK,
        minRelevanceScore,
      });
    } catch (error) {
      log.error('❌ RAG AGENT: Context retrieval failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Check if user has documents
   */
  async hasDocuments(userId: string): Promise<boolean> {
    const { supabase } = await import('../../models/database.js');
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      log.error('Failed to check documents', { error: error.message, userId });
      return false;
    }
    return (count || 0) > 0;
  }
}

// Singleton instance
export const ragAgent = new RAGAgent();
