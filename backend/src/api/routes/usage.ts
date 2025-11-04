/**
 * Usage & Budget API Routes
 * Handles user usage statistics, costs, and budget tracking
 */

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/usage
 * Get usage statistics for the current month (or specified month)
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { month } = req.query; // Format: YYYY-MM

    // Default to current month
    const targetMonth = month as string || new Date().toISOString().slice(0, 7);

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    // Get usage record for the month (single row per user per month)
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', targetMonth)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine for a new month
      throw new Error(`Failed to fetch usage: ${usageError.message}`);
    }

    // Get user settings for budget limit
    const { data: settings } = await supabase
      .from('user_settings')
      .select('monthly_budget_limit')
      .eq('user_id', userId)
      .single();

    const budgetLimit = settings?.monthly_budget_limit || 10.0;

    // Extract data from usage record
    const totalCost = usage?.total_cost_usd || 0;
    const usageByModel = (usage?.usage_by_model as Record<string, any>) || {};

    // Calculate aggregate statistics from usage_by_model JSONB
    let totalTokens = 0;
    let totalMessages = 0;
    const costByModel: Record<string, number> = {};
    const tokensByModel: Record<string, number> = {};

    Object.entries(usageByModel).forEach(([model, data]: [string, any]) => {
      const inputTokens = data.input || 0;
      const outputTokens = data.output || 0;
      const cost = data.cost || 0;

      totalTokens += inputTokens + outputTokens;
      costByModel[model] = cost;
      tokensByModel[model] = inputTokens + outputTokens;
    });

    // Count messages from the messages table for this month
    const startDate = `${targetMonth}-01`;
    const endDate = new Date(targetMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .gte('created_at', startDate)
      .lt('created_at', endDateStr);

    totalMessages = messageCount || 0;

    const response = {
      month: targetMonth,
      totalMessages,
      totalTokens,
      totalCostUsd: Number(totalCost.toFixed(4)),
      budgetLimitUsd: budgetLimit,
      budgetRemaining: Number((budgetLimit - totalCost).toFixed(4)),
      percentUsed: Number(((totalCost / budgetLimit) * 100).toFixed(2)),
      costByModel,
      tokensByModel,
    };

    res.json(response);
  } catch (error: any) {
    log.error('Failed to get usage statistics', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Failed to get usage',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/usage/budget
 * Get current budget status (quick check)
 */
router.get('/budget', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get current month usage (single row per user per month)
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('total_cost_usd')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    // PGRST116 = no rows returned, which is fine for a new month
    if (usageError && usageError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch usage: ${usageError.message}`);
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('monthly_budget_limit')
      .eq('user_id', userId)
      .single();

    const budgetLimit = settings?.monthly_budget_limit || 10.0;
    const currentCost = usage?.total_cost_usd || 0;
    const percentUsed = (currentCost / budgetLimit) * 100;

    const response = {
      currentCostUsd: Number(currentCost.toFixed(4)),
      limitUsd: budgetLimit,
      remainingUsd: Number((budgetLimit - currentCost).toFixed(4)),
      percentUsed: Number(percentUsed.toFixed(2)),
      warningThreshold: 80,
      isWarning: percentUsed >= 80,
      isExceeded: percentUsed >= 100,
    };

    res.json(response);
  } catch (error: any) {
    log.error('Failed to get budget status', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Failed to get budget status',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
