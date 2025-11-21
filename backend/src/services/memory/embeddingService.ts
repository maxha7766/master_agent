/**
 * Embedding Service
 * Generates vector embeddings for memories and entities using OpenAI
 */

import OpenAI from 'openai';
import { log } from '../../lib/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
      dimensions: EMBEDDING_DIMENSIONS, // Specify 1536 dimensions
    });

    return response.data[0].embedding;
  } catch (error) {
    log.error('Failed to generate embedding', {
      error: error instanceof Error ? error.message : String(error),
      textLength: text.length,
    });
    throw new Error('Embedding generation failed');
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
      dimensions: EMBEDDING_DIMENSIONS, // Specify 1536 dimensions
    });

    // Sort by index to ensure correct order
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  } catch (error) {
    log.error('Failed to generate batch embeddings', {
      error: error instanceof Error ? error.message : String(error),
      count: texts.length,
    });
    throw new Error('Batch embedding generation failed');
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Rank items by similarity to query embedding
 */
export function rankBySimilarity<T extends { embedding: number[] | null }>(
  items: T[],
  queryEmbedding: number[]
): Array<T & { similarity: number }> {
  return items
    .filter((item) => item.embedding !== null)
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding!),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get embedding model info
 */
export function getEmbeddingModelInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    costPer1kTokens: 0.00013, // $0.13 per 1M tokens
  };
}
