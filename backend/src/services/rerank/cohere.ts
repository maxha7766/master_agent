/**
 * Cohere Reranking Service
 * Uses Cohere's rerank API to improve search result relevance
 */

import { CohereClient } from 'cohere-ai';
import { log } from '../../lib/logger.js';

export interface RerankDocument {
  id: string;
  text: string;
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
  document: RerankDocument;
}

export interface RerankOptions {
  topK?: number;
  model?: string;
}

class CohereRerankService {
  private client: CohereClient | null = null;
  private enabled: boolean = false;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;

    if (apiKey) {
      try {
        this.client = new CohereClient({
          token: apiKey,
        });
        this.enabled = true;
        log.info('Cohere reranking service initialized');
      } catch (error) {
        log.warn('Failed to initialize Cohere client', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.enabled = false;
      }
    } else {
      log.info('Cohere API key not found, reranking disabled');
      this.enabled = false;
    }
  }

  /**
   * Check if reranking is available
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    if (!this.isEnabled() || !this.client) {
      log.warn('Cohere reranking not available, returning documents in original order');
      return documents.map((doc, index) => ({
        index,
        relevanceScore: 1.0 / (index + 1), // Simple fallback ranking
        document: doc,
      }));
    }

    const {
      topK = Math.min(documents.length, 10),
      model = 'rerank-english-v3.0',
    } = options;

    try {
      log.info('Reranking documents with Cohere', {
        query,
        documentCount: documents.length,
        topK,
      });

      const response = await this.client.rerank({
        query,
        documents: documents.map(doc => doc.text),
        topN: topK,
        model,
      });

      // Map results back to include document metadata
      const results: RerankResult[] = response.results.map((result) => ({
        index: result.index,
        relevanceScore: result.relevanceScore,
        document: documents[result.index],
      }));

      log.info('Reranking complete', {
        originalCount: documents.length,
        rerankCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('Cohere reranking failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: return original order with simple scoring
      return documents.map((doc, index) => ({
        index,
        relevanceScore: 1.0 / (index + 1),
        document: doc,
      }));
    }
  }
}

// Singleton instance
export const cohereRerankService = new CohereRerankService();
