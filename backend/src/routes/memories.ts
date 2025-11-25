/**
 * Memory API Routes
 * REST endpoints for managing user memories and entities
 */

import { Router } from 'express';
import { authMiddleware as authenticateUser } from '../api/middleware/auth.js';
import { getAllMemories, deleteMemory, updateMemory } from '../services/memory/memoryManager.js';
import {
  getAllEntities,
  getEntityWithRelations,
  retrieveRelevantEntities,
} from '../services/memory/entityManager.js';
import {
  findSimilarMemories,
  mergeMemories,
  applyMemoryDecay,
  recalculateImportanceScores,
} from '../services/memory/memoryConsolidation.js';
import { getUserSummaries } from '../services/memory/conversationSummarizer.js';
import { log } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/memories
 * Get all memories for the authenticated user
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const includeInactive = req.query.includeInactive === 'true';

    const memories = await getAllMemories(userId, includeInactive);

    res.json({
      memories,
      count: memories.length,
    });
  } catch (error) {
    log.error('Failed to get memories', { error });
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete (soft) a memory
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;

    const success = await deleteMemory(memoryId, userId);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Memory not found' });
    }
  } catch (error) {
    log.error('Failed to delete memory', { error });
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * PATCH /api/memories/:id
 * Update a memory
 */
router.patch('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;
    const updates = req.body;

    const memory = await updateMemory(memoryId, userId, updates);

    if (memory) {
      res.json(memory);
    } else {
      res.status(404).json({ error: 'Memory not found' });
    }
  } catch (error) {
    log.error('Failed to update memory', { error });
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

/**
 * GET /api/memories/entities
 * Get all entities for the authenticated user
 */
router.get('/entities', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const entityType = req.query.type as string | undefined;

    const entities = await getAllEntities(userId, entityType as any);

    res.json({
      entities,
      count: entities.length,
    });
  } catch (error) {
    log.error('Failed to get entities', { error });
    res.status(500).json({ error: 'Failed to retrieve entities' });
  }
});

/**
 * GET /api/memories/entities/:id
 * Get entity with relationships
 */
router.get('/entities/:id', authenticateUser, async (req, res) => {
  try {
    const entityId = req.params.id;

    const entityData = await getEntityWithRelations(entityId);

    if (entityData) {
      res.json(entityData);
    } else {
      res.status(404).json({ error: 'Entity not found' });
    }
  } catch (error) {
    log.error('Failed to get entity', { error });
    res.status(500).json({ error: 'Failed to retrieve entity' });
  }
});

/**
 * GET /api/memories/summaries
 * Get conversation summaries for the user
 */
router.get('/summaries', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const summaries = await getUserSummaries(userId);

    res.json({
      summaries,
      count: summaries.length,
    });
  } catch (error) {
    log.error('Failed to get summaries', { error });
    res.status(500).json({ error: 'Failed to retrieve summaries' });
  }
});

/**
 * POST /api/memories/consolidate
 * Find and merge similar memories
 */
router.post('/consolidate', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const threshold = parseFloat(req.body.threshold) || 0.95;

    const similarPairs = await findSimilarMemories(userId, threshold);

    // Auto-merge highly similar memories
    let mergedCount = 0;
    for (const pair of similarPairs) {
      if (pair.similarity >= 0.98) {
        // Very high similarity, auto-merge
        await mergeMemories(pair.memory1.id, pair.memory2.id, userId);
        mergedCount++;
      }
    }

    res.json({
      similarPairsFound: similarPairs.length,
      autoMerged: mergedCount,
      requiresReview: similarPairs.length - mergedCount,
      pairs: similarPairs.slice(0, 10), // Return first 10 for review
    });
  } catch (error) {
    log.error('Failed to consolidate memories', { error });
    res.status(500).json({ error: 'Failed to consolidate memories' });
  }
});

/**
 * POST /api/memories/decay
 * Apply memory decay to old memories
 */
router.post('/decay', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const decayedCount = await applyMemoryDecay(userId);

    res.json({
      decayedCount,
      message: `Applied decay to ${decayedCount} memories`,
    });
  } catch (error) {
    log.error('Failed to apply memory decay', { error });
    res.status(500).json({ error: 'Failed to apply memory decay' });
  }
});

/**
 * POST /api/memories/recalculate-importance
 * Recalculate importance scores for all memories
 */
router.post('/recalculate-importance', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const updatedCount = await recalculateImportanceScores(userId);

    res.json({
      updatedCount,
      message: `Recalculated importance for ${updatedCount} memories`,
    });
  } catch (error) {
    log.error('Failed to recalculate importance', { error });
    res.status(500).json({ error: 'Failed to recalculate importance' });
  }
});

/**
 * GET /api/memories/stats
 * Get memory statistics for the user
 */
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [memories, entities] = await Promise.all([
      getAllMemories(userId, false),
      getAllEntities(userId),
    ]);

    // Calculate stats
    const stats = {
      totalMemories: memories.length,
      memoryTypes: memories.reduce((acc, m) => {
        acc[m.memory_type] = (acc[m.memory_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalEntities: entities.length,
      entityTypes: entities.reduce((acc, e) => {
        acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgConfidence:
        memories.reduce((sum, m) => sum + m.confidence_score, 0) / memories.length || 0,
      avgImportance:
        memories.reduce((sum, m) => sum + m.importance_score, 0) / memories.length || 0,
      mostAccessedMemory: memories.sort((a, b) => b.access_count - a.access_count)[0] || null,
      mostMentionedEntity: entities.sort((a, b) => b.mention_count - a.mention_count)[0] || null,
    };

    res.json(stats);
  } catch (error) {
    log.error('Failed to get memory stats', { error });
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

export default router;
