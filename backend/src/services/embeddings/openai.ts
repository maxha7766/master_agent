/**
 * OpenAI Embeddings Service
 * Generates vector embeddings using OpenAI text-embedding-3-large
 */

import OpenAI from 'openai';
import { log } from '../../lib/logger.js';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class OpenAIEmbeddingsService {
  private client: OpenAI;
  private defaultModel = 'text-embedding-3-large';
  private defaultDimensions = 1536;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const model = options.model || this.defaultModel;
    const dimensions = options.dimensions || this.defaultDimensions;

    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
        dimensions,
      });

      return {
        embedding: response.data[0].embedding,
        tokens: response.usage.total_tokens,
      };
    } catch (error) {
      log.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
        model,
        textLength: text.length,
      });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult[]> {
    const model = options.model || this.defaultModel;
    const dimensions = options.dimensions || this.defaultDimensions;

    try {
      const response = await this.client.embeddings.create({
        model,
        input: texts,
        dimensions,
      });

      return response.data.map((item) => ({
        embedding: item.embedding,
        tokens: response.usage.total_tokens / texts.length, // Approximate per-text tokens
      }));
    } catch (error) {
      log.error('Failed to generate batch embeddings', {
        error: error instanceof Error ? error.message : String(error),
        model,
        batchSize: texts.length,
      });
      throw error;
    }
  }

  /**
   * Calculate cost for embedding generation
   */
  calculateCost(tokens: number, model?: string): number {
    const pricing: Record<string, number> = {
      'text-embedding-3-large': 0.00013 / 1000, // $0.00013 per 1K tokens
      'text-embedding-3-small': 0.00002 / 1000, // $0.00002 per 1K tokens
      'text-embedding-ada-002': 0.0001 / 1000, // $0.0001 per 1K tokens
    };

    const modelKey = model || this.defaultModel;
    const pricePerToken = pricing[modelKey] || pricing['text-embedding-3-large'];

    return tokens * pricePerToken;
  }
}

// Singleton instance
export const embeddingsService = new OpenAIEmbeddingsService();
