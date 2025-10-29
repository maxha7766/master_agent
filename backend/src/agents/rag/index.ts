/**
 * RAG Agent
 * Retrieval Augmented Generation for document-aware responses
 */

import { vectorSearchService, SearchResult } from '../../services/rag/search.js';
import { LLMProvider } from '../../services/llm/provider.js';
import { AnthropicProvider } from '../../services/llm/anthropic.js';
import { log } from '../../lib/logger.js';

export interface RAGOptions {
  topK?: number;
  minRelevanceScore?: number;
  model?: string;
  temperature?: number;
  includeSources?: boolean;
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
  private llm: LLMProvider;

  constructor() {
    this.llm = new AnthropicProvider();
  }

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
      minRelevanceScore = 0.3,
      model = 'claude-sonnet-4-20250514',
      temperature = 0.7,
      includeSources = true,
    } = options;

    try {
      log.info('RAG query started', {
        query,
        userId,
        topK,
      });

      // Step 1: Retrieve relevant document chunks
      const searchResults = await vectorSearchService.search(query, userId, {
        topK,
        minRelevanceScore,
      });

      log.info('Retrieved chunks', {
        userId,
        chunksFound: searchResults.length,
      });

      // Step 2: Build context from chunks
      const context = this.buildContext(searchResults);

      // Step 3: Generate response with LLM
      const systemPrompt = this.buildSystemPrompt(includeSources);
      const userPrompt = this.buildUserPrompt(query, context);

      const llmResponse = await this.llm.chat(
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
        chunksUsed: searchResults.length,
        tokensUsed: llmResponse.tokensUsed,
        latencyMs,
      });

      return {
        content: llmResponse.content,
        sources: searchResults.map((r) => ({
          documentId: r.documentId,
          fileName: r.fileName || 'Unknown',
          chunkIndex: r.chunkIndex || 0,
          pageNumber: r.pageNumber,
          relevanceScore: r.relevanceScore,
          excerpt: this.createExcerpt(r.content, 150),
        })),
        metadata: {
          chunksRetrieved: searchResults.length,
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
      minRelevanceScore = 0.3,
      model = 'claude-sonnet-4-20250514',
      temperature = 0.7,
      includeSources = true,
    } = options;

    // Retrieve relevant chunks
    const searchResults = await vectorSearchService.search(query, userId, {
      topK,
      minRelevanceScore,
    });

    // Build prompts
    const context = this.buildContext(searchResults);
    const systemPrompt = this.buildSystemPrompt(includeSources);
    const userPrompt = this.buildUserPrompt(query, context);

    // Stream LLM response
    let fullContent = '';
    let tokensUsed = 0;
    const startTime = Date.now();

    for await (const chunk of this.llm.chatStream(
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
      sources: searchResults.map((r) => ({
        documentId: r.documentId,
        fileName: r.fileName || 'Unknown',
        chunkIndex: r.chunkIndex || 0,
        pageNumber: r.pageNumber,
        relevanceScore: r.relevanceScore,
        excerpt: this.createExcerpt(r.content, 150),
      })),
      metadata: {
        chunksRetrieved: searchResults.length,
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
   * Following master-rag conversational approach
   */
  private buildSystemPrompt(includeSources: boolean): string {
    const basePrompt = `You are a friendly assistant with strong research skills and access to a RAG database with a large store of the user's documents. When queried, search the RAG database for information to help respond. Be conversational and helpful. You don't have to state your purpose.

Guidelines:
1. Be conversational and approachable - Think of yourself as a helpful colleague who's great at finding information
2. Ask clarifying questions when the user's request is unclear or could be interpreted in multiple ways
3. Offer to explore related topics - After answering, ask if the user would like you to share related information you found that might be interesting
4. Stay grounded in your sources - Answer based ONLY on the provided context
5. Be honest about limitations - If the context doesn't contain enough information, say so clearly and suggest what additional information might help
6. Provide specific details from the documents when relevant, but explain them in an accessible way`;

    if (includeSources) {
      return (
        basePrompt +
        `\n7. Cite your sources using [Source 1], [Source 2], etc. notation for transparency - reference them inline when making specific claims`
      );
    }

    return basePrompt;
  }

  /**
   * Build user prompt with query and context
   * Following master-rag warm, conversational approach
   */
  private buildUserPrompt(query: string, context: string): string {
    return `Hi! I'm here to help you explore the information in your document collection.

Your question: ${query}

Context from retrieved documents:
${context}

Let me provide you with what I found, and feel free to ask follow-up questions or let me know if you'd like me to explore any related topics I came across!`;
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
