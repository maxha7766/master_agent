/**
 * Memory Manager
 * Core service for managing user memories, storage, and retrieval
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { generateEmbedding, generateEmbeddingsBatch } from './embeddingService.js';
import type {
  UserMemory,
  MemoryInsert,
  MemoryUpdate,
  MemorySearchResult,
  MemoryRetrievalOptions,
} from './types.js';

/**
 * Store a new memory with embedding
 */
export async function storeMemory(memory: MemoryInsert): Promise<UserMemory | null> {
  try {
    // Generate embedding if not provided
    let embedding = memory.embedding;
    if (!embedding) {
      embedding = await generateEmbedding(memory.content);
    }

    const { data, error } = await supabase
      .from('user_memories')
      .insert({
        ...memory,
        embedding,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to store memory', { error, memory });
      return null;
    }

    log.info('Memory stored successfully', {
      memoryId: data.id,
      type: data.memory_type,
      userId: data.user_id,
    });

    return data;
  } catch (error) {
    log.error('Error storing memory', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Store multiple memories in batch
 */
export async function storeMemoriesBatch(memories: MemoryInsert[]): Promise<UserMemory[]> {
  if (memories.length === 0) {
    return [];
  }

  try {
    // Generate embeddings for all memories that don't have them
    const textsToEmbed = memories
      .filter((m) => !m.embedding)
      .map((m) => m.content);

    let embeddings: number[][] = [];
    if (textsToEmbed.length > 0) {
      embeddings = await generateEmbeddingsBatch(textsToEmbed);
    }

    // Attach embeddings to memories
    let embeddingIndex = 0;
    const memoriesWithEmbeddings = memories.map((memory) => {
      if (memory.embedding) {
        return memory;
      }
      return {
        ...memory,
        embedding: embeddings[embeddingIndex++],
      };
    });

    const { data, error } = await supabase
      .from('user_memories')
      .insert(memoriesWithEmbeddings)
      .select();

    if (error || !data) {
      log.error('Failed to store memories batch', { error, count: memories.length });
      return [];
    }

    log.info('Memories stored in batch', {
      count: data.length,
      userId: memories[0]?.user_id,
    });

    return data;
  } catch (error) {
    log.error('Error storing memories batch', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Retrieve relevant memories using semantic search
 */
export async function retrieveRelevantMemories(
  query: string,
  userId: string,
  options: MemoryRetrievalOptions = {}
): Promise<MemorySearchResult[]> {
  const {
    topK = 5,
    minSimilarity = 0.7,
    memoryTypes,
    tags,
    includeInactive = false,
  } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Build the query
    let query_builder = supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId);

    // Add filters
    if (!includeInactive) {
      query_builder = query_builder.eq('is_active', true);
    }

    if (memoryTypes && memoryTypes.length > 0) {
      query_builder = query_builder.in('memory_type', memoryTypes);
    }

    if (tags && tags.length > 0) {
      query_builder = query_builder.overlaps('tags', tags);
    }

    const { data: memories, error } = await query_builder;

    if (error || !memories) {
      log.error('Failed to retrieve memories', { error, userId });
      return [];
    }

    // Calculate similarity scores
    const memoriesWithScores: MemorySearchResult[] = memories
      .map((memory) => {
        if (!memory.embedding) {
          return null;
        }

        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryEmbedding, memory.embedding);

        return {
          ...memory,
          similarity,
        };
      })
      .filter((m): m is MemorySearchResult => m !== null && m.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    log.info('Memories retrieved', {
      userId,
      query: query.substring(0, 50),
      resultsCount: memoriesWithScores.length,
    });

    return memoriesWithScores;
  } catch (error) {
    log.error('Error retrieving memories', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}

/**
 * Helper function to calculate cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Update a memory
 */
export async function updateMemory(
  memoryId: string,
  userId: string,
  updates: MemoryUpdate
): Promise<UserMemory | null> {
  try {
    // If content is updated, regenerate embedding
    if (updates.content && !updates.embedding) {
      updates.embedding = await generateEmbedding(updates.content);
    }

    const { data, error } = await supabase
      .from('user_memories')
      .update(updates)
      .eq('id', memoryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      log.error('Failed to update memory', { error, memoryId });
      return null;
    }

    log.info('Memory updated', { memoryId });
    return data;
  } catch (error) {
    log.error('Error updating memory', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Track memory access (update last_accessed_at and access_count)
 */
export async function trackMemoryAccess(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) {
    return;
  }

  try {
    // Increment access count and update last_accessed_at for each memory
    await supabase.rpc('increment_memory_access', {
      memory_ids: memoryIds,
    });

    log.debug('Memory access tracked', { count: memoryIds.length });
  } catch (error) {
    log.error('Failed to track memory access', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete a memory (soft delete by setting is_active = false)
 */
export async function deleteMemory(memoryId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_memories')
      .update({ is_active: false })
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to delete memory', { error, memoryId });
      return false;
    }

    log.info('Memory deleted (soft)', { memoryId });
    return true;
  } catch (error) {
    log.error('Error deleting memory', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Hard delete a memory (permanent)
 */
export async function hardDeleteMemory(memoryId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to hard delete memory', { error, memoryId });
      return false;
    }

    log.info('Memory deleted (hard)', { memoryId });
    return true;
  } catch (error) {
    log.error('Error hard deleting memory', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get all memories for a user
 */
export async function getAllMemories(userId: string, includeInactive: boolean = false): Promise<UserMemory[]> {
  try {
    let query_builder = supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query_builder = query_builder.eq('is_active', true);
    }

    const { data, error } = await query_builder;

    if (error || !data) {
      log.error('Failed to get all memories', { error, userId });
      return [];
    }

    return data;
  } catch (error) {
    log.error('Error getting all memories', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Update memory importance based on access patterns
 */
export async function updateMemoryImportance(
  memoryId: string,
  newImportance: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_memories')
      .update({ importance_score: newImportance })
      .eq('id', memoryId);

    if (error) {
      log.error('Failed to update memory importance', { error, memoryId });
      return false;
    }

    return true;
  } catch (error) {
    log.error('Error updating memory importance', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Format memories for prompt inclusion
 */
export function formatMemoriesForPrompt(memories: MemorySearchResult[]): string {
  if (memories.length === 0) {
    return '';
  }

  const grouped = memories.reduce((acc, memory) => {
    if (!acc[memory.memory_type]) {
      acc[memory.memory_type] = [];
    }
    acc[memory.memory_type].push(memory);
    return acc;
  }, {} as Record<string, MemorySearchResult[]>);

  let formatted = '\n**What I remember about you:**\n';
  formatted += '(Use these only when directly relevant — don\'t force them into conversation)\n\n';

  if (grouped.fact) {
    formatted += '**Facts:**\n';
    grouped.fact.forEach((m, i) => {
      formatted += `${i + 1}. ${m.content}\n`;
    });
    formatted += '\n';
  }

  if (grouped.preference) {
    formatted += '**Preferences:**\n';
    grouped.preference.forEach((m, i) => {
      formatted += `${i + 1}. ${m.content}\n`;
    });
    formatted += '\n';
  }

  if (grouped.insight) {
    formatted += '**Insights:**\n';
    grouped.insight.forEach((m, i) => {
      formatted += `${i + 1}. ${m.content}\n`;
    });
    formatted += '\n';
  }

  if (grouped.event) {
    formatted += '**Past Events:**\n';
    grouped.event.forEach((m, i) => {
      formatted += `${i + 1}. ${m.content}\n`;
    });
    formatted += '\n';
  }

  return formatted;
}
