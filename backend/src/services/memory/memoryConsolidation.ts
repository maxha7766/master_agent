/**
 * Memory Consolidation Service
 * Merges similar memories and manages memory decay
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { generateEmbedding } from './embeddingService.js';
import type { UserMemory, MemoryUpdate } from './types.js';

/**
 * Find duplicate or highly similar memories
 */
export async function findSimilarMemories(
  userId: string,
  similarityThreshold: number = 0.95
): Promise<Array<{ memory1: UserMemory; memory2: UserMemory; similarity: number }>> {
  try {
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('embedding', 'is', null);

    if (error || !memories) {
      return [];
    }

    const similarPairs: Array<{ memory1: UserMemory; memory2: UserMemory; similarity: number }> =
      [];

    // Compare all pairs
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const mem1 = memories[i];
        const mem2 = memories[j];

        if (!mem1.embedding || !mem2.embedding) continue;

        const similarity = cosineSimilarity(mem1.embedding, mem2.embedding);

        if (similarity >= similarityThreshold) {
          similarPairs.push({
            memory1: mem1,
            memory2: mem2,
            similarity,
          });
        }
      }
    }

    log.info('Found similar memories', {
      userId,
      pairCount: similarPairs.length,
    });

    return similarPairs;
  } catch (error) {
    log.error('Error finding similar memories', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Merge two similar memories into one
 */
export async function mergeMemories(
  memory1Id: string,
  memory2Id: string,
  userId: string
): Promise<UserMemory | null> {
  try {
    // Get both memories
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .in('id', [memory1Id, memory2Id])
      .eq('user_id', userId);

    if (error || !memories || memories.length !== 2) {
      log.error('Failed to fetch memories for merge', { error });
      return null;
    }

    const [mem1, mem2] = memories;

    // Combine content
    const mergedContent = `${mem1.content}; ${mem2.content}`;

    // Take highest confidence and importance
    const mergedConfidence = Math.max(mem1.confidence_score, mem2.confidence_score);
    const mergedImportance = Math.max(mem1.importance_score, mem2.importance_score);

    // Combine tags
    const mergedTags = [...new Set([...mem1.tags, ...mem2.tags])];

    // Combine source message IDs
    const mergedSourceIds = [
      ...new Set([...mem1.source_message_ids, ...mem2.source_message_ids]),
    ];

    // Keep most accessed
    const accessCount = mem1.access_count + mem2.access_count;

    // Generate new embedding for merged content
    const embedding = await generateEmbedding(mergedContent);

    // Update the first memory
    const { data: updatedMemory, error: updateError } = await supabase
      .from('user_memories')
      .update({
        content: mergedContent,
        embedding,
        confidence_score: mergedConfidence,
        importance_score: mergedImportance,
        tags: mergedTags,
        source_message_ids: mergedSourceIds,
        access_count: accessCount,
      })
      .eq('id', mem1.id)
      .select()
      .single();

    if (updateError || !updatedMemory) {
      log.error('Failed to update merged memory', { updateError });
      return null;
    }

    // Soft delete the second memory
    await supabase
      .from('user_memories')
      .update({ is_active: false })
      .eq('id', mem2.id);

    log.info('Memories merged', {
      userId,
      keptMemoryId: mem1.id,
      deletedMemoryId: mem2.id,
    });

    return updatedMemory;
  } catch (error) {
    log.error('Error merging memories', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Apply memory decay based on access patterns
 * Reduces importance of memories that haven't been accessed recently
 */
export async function applyMemoryDecay(userId: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldMemories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lt('last_accessed_at', thirtyDaysAgo.toISOString());

    if (error || !oldMemories) {
      return 0;
    }

    let decayedCount = 0;

    for (const memory of oldMemories) {
      // Reduce importance by 10%
      const newImportance = Math.max(0.1, memory.importance_score * 0.9);

      // If importance drops below threshold, deactivate
      if (newImportance < 0.2) {
        await supabase
          .from('user_memories')
          .update({ is_active: false })
          .eq('id', memory.id);
      } else {
        await supabase
          .from('user_memories')
          .update({ importance_score: newImportance })
          .eq('id', memory.id);
      }

      decayedCount++;
    }

    log.info('Memory decay applied', {
      userId,
      decayedCount,
    });

    return decayedCount;
  } catch (error) {
    log.error('Error applying memory decay', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Calculate memory importance based on multiple factors
 */
export function calculateImportance(
  accessCount: number,
  confidenceScore: number,
  daysSinceCreation: number,
  daysSinceLastAccess: number
): number {
  // Factors:
  // 1. Access frequency (0-1)
  const accessFactor = Math.min(1, accessCount / 10);

  // 2. Confidence (0-1)
  const confidenceFactor = confidenceScore;

  // 3. Recency of creation (decays over time)
  const recencyFactor = Math.exp(-daysSinceCreation / 365);

  // 4. Recency of access (decays over time)
  const accessRecencyFactor = Math.exp(-daysSinceLastAccess / 90);

  // Weighted average
  const importance =
    accessFactor * 0.3 +
    confidenceFactor * 0.2 +
    recencyFactor * 0.2 +
    accessRecencyFactor * 0.3;

  return Math.max(0, Math.min(1, importance));
}

/**
 * Recalculate importance scores for all memories
 */
export async function recalculateImportanceScores(userId: string): Promise<number> {
  try {
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !memories) {
      return 0;
    }

    const now = new Date();
    let updatedCount = 0;

    for (const memory of memories) {
      const createdAt = new Date(memory.created_at);
      const lastAccessed = new Date(memory.last_accessed_at);

      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceLastAccess = Math.floor(
        (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
      );

      const newImportance = calculateImportance(
        memory.access_count,
        memory.confidence_score,
        daysSinceCreation,
        daysSinceLastAccess
      );

      await supabase
        .from('user_memories')
        .update({ importance_score: newImportance })
        .eq('id', memory.id);

      updatedCount++;
    }

    log.info('Importance scores recalculated', {
      userId,
      updatedCount,
    });

    return updatedCount;
  } catch (error) {
    log.error('Error recalculating importance scores', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Helper: Calculate cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

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
