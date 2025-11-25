/**
 * User Settings API Routes
 * Handles user preferences for LLM models, budget limits, and other settings
 */

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/settings
 * Get current user settings
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings exist, create default settings
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: createError} = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            default_chat_model: 'claude-sonnet-4-5-20250929',
            monthly_budget_limit: 10.0,
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create default settings: ${createError.message}`);
        }

        return res.json(newSettings);
      }

      throw new Error(`Failed to fetch settings: ${error.message}`);
    }

    res.json(settings);
  } catch (error: any) {
    log.error('Failed to get user settings', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Failed to get settings',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const updates = req.body;

    // Validate allowed fields
    const allowedFields = [
      'default_chat_model',
      'monthly_budget_limit',
      'rag_model',
      'sql_model',
      'research_model',
    ];

    const filteredUpdates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Validate budget limit
    if (filteredUpdates.monthly_budget_limit !== undefined) {
      const budget = Number(filteredUpdates.monthly_budget_limit);
      if (isNaN(budget) || budget < 0 || budget > 1000) {
        return res.status(400).json({
          error: 'Invalid budget limit. Must be between 0 and 1000',
        });
      }
    }

    // Validate model names (API Available Only - Tested and Working)
    const validModels = [
      // Claude Models
      'claude-sonnet-4-5-20250929',
      'claude-3-haiku-20240307',
      // GPT-5 Series
      'gpt-5.1',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      // GPT-4 Series
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      // Reasoning Models
      'o1',
    ];

    for (const field of ['default_chat_model', 'rag_model', 'sql_model', 'research_model']) {
      if (filteredUpdates[field] && !validModels.includes(filteredUpdates[field])) {
        return res.status(400).json({
          error: `Invalid model: ${filteredUpdates[field]}`,
        });
      }
    }

    // Update settings
    const { data: settings, error } = await supabase
      .from('user_settings')
      .update(filteredUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    log.info('User settings updated', { userId, updates: filteredUpdates });

    res.json(settings);
  } catch (error: any) {
    log.error('Failed to update user settings', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
