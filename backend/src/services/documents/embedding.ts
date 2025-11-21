/**
 * Document Embedding Service
 * Wrapper around OpenAI embeddings for document processing
 */

import { embeddingsService } from '../embeddings/openai.js';
import { log } from '../../lib/logger.js';

export interface BatchEmbeddingOptions {
  batchSize?: number; // Process N texts at a time
}

export class EmbeddingService {
  /**
   * Generate embeddings for a batch of texts
   * Processes in smaller batches to avoid rate limits
   */
  async generateBatch(
    texts: string[],
    options: BatchEmbeddingOptions = {}
  ): Promise<number[][]> {
    const { batchSize = 50 } = options;
    const embeddings: number[][] = [];

    log.info('Generating embeddings batch', {
      totalTexts: texts.length,
      batchSize,
    });

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const results = await embeddingsService.embedBatch(batch);
        embeddings.push(...results.map((r) => r.embedding));

        log.info('Batch embeddings generated', {
          batchStart: i,
          batchSize: batch.length,
          progress: `${Math.min(i + batchSize, texts.length)}/${texts.length}`,
        });
      } catch (error) {
        log.error('Failed to generate batch embeddings', {
          batchStart: i,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return embeddings;
  }

  /**
   * Generate embedding for a single text
   */
  async generateOne(text: string): Promise<number[]> {
    const result = await embeddingsService.embedText(text);
    return result.embedding;
  }
}
