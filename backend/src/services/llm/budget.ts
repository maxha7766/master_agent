import { supabase } from '../../models/database';
import { calculateLLMCost, getCurrentMonth } from '../../lib/utils';
import { BudgetExceededError } from '../../lib/errors';
import { log } from '../../lib/logger';

const MONTHLY_BUDGET_USD = parseFloat(process.env.MONTHLY_BUDGET_USD || '10.00');
const BUDGET_WARNING_THRESHOLD = 0.8; // Warn at 80%

/**
 * Budget Tracking Service
 * Manages user LLM API cost budgets and enforces limits
 */
export class BudgetService {
  /**
   * Check if user has budget available for estimated cost
   * Throws BudgetExceededError if budget is exceeded
   * Returns budget warning if threshold reached
   */
  static async checkBudget(userId: string, estimatedCost: number): Promise<{
    warning?: {
      type: 'budget_warning';
      currentCost: number;
      limit: number;
      percentUsed: number;
      threshold: number;
    };
  }> {
    const month = getCurrentMonth();

    // Get current usage for this month
    const { data: usage, error } = await supabase
      .from('user_usage')
      .select('total_cost_usd, budget_limit_reached, budget_warning_sent')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      log.error('Failed to check budget', { userId, month, error: error.message });
      throw error;
    }

    const currentCost = usage?.total_cost_usd || 0;
    const newTotal = currentCost + estimatedCost;

    // Check if budget exceeded
    if (newTotal > MONTHLY_BUDGET_USD) {
      // Mark budget limit reached
      if (!usage?.budget_limit_reached) {
        await this.markBudgetLimitReached(userId, month);
      }

      throw new BudgetExceededError(currentCost, MONTHLY_BUDGET_USD);
    }

    // Check if approaching budget limit (80%)
    if (
      newTotal > MONTHLY_BUDGET_USD * BUDGET_WARNING_THRESHOLD &&
      !usage?.budget_warning_sent
    ) {
      await this.sendBudgetWarning(userId, month, currentCost);
    }

    return undefined;
  }

  /**
   * Track LLM usage and update costs
   */
  static async trackUsage(
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const month = getCurrentMonth();
    const cost = calculateLLMCost(inputTokens, outputTokens, model);

    // Get existing usage
    const { data: existing } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    const usageByModel = (existing?.usage_by_model as Record<string, unknown>) || {};
    const modelUsage = (usageByModel[model] as {
      input: number;
      output: number;
      cost: number;
    }) || {
      input: 0,
      output: 0,
      cost: 0,
    };

    // Update model-specific usage
    modelUsage.input += inputTokens;
    modelUsage.output += outputTokens;
    modelUsage.cost += cost;
    usageByModel[model] = modelUsage;

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_usage')
        .update({
          total_cost_usd: existing.total_cost_usd + cost,
          usage_by_model: usageByModel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        log.error('Failed to update usage', { userId, month, error: updateError.message });
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase.from('user_usage').insert({
        user_id: userId,
        month,
        total_cost_usd: cost,
        usage_by_model: usageByModel,
      });

      if (insertError) {
        log.error('Failed to insert usage', { userId, month, error: insertError.message });
      }
    }

    log.info('LLM usage tracked', {
      userId,
      model,
      inputTokens,
      outputTokens,
      cost: Number(cost.toFixed(4)),
    });
  }

  /**
   * Get user's current month usage
   */
  static async getCurrentUsage(userId: string): Promise<{
    totalCost: number;
    budgetLimit: number;
    percentUsed: number;
    usageByModel: Record<string, unknown>;
  }> {
    const month = getCurrentMonth();

    const { data: usage } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    const totalCost = usage?.total_cost_usd || 0;

    return {
      totalCost,
      budgetLimit: MONTHLY_BUDGET_USD,
      percentUsed: (totalCost / MONTHLY_BUDGET_USD) * 100,
      usageByModel: (usage?.usage_by_model as Record<string, unknown>) || {},
    };
  }

  /**
   * Mark budget limit as reached
   */
  private static async markBudgetLimitReached(userId: string, month: string): Promise<void> {
    await supabase
      .from('user_usage')
      .update({
        budget_limit_reached: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month', month);

    log.warn('Budget limit reached', { userId, month, limit: MONTHLY_BUDGET_USD });
  }

  /**
   * Send budget warning notification
   */
  private static async sendBudgetWarning(
    userId: string,
    month: string,
    currentCost: number
  ): Promise<void> {
    await supabase
      .from('user_usage')
      .update({
        budget_warning_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month', month);

    const percentUsed = (currentCost / MONTHLY_BUDGET_USD) * 100;

    log.warn('Budget warning threshold reached', {
      userId,
      month,
      currentCost: currentCost.toFixed(2),
      limit: MONTHLY_BUDGET_USD,
      threshold: `${BUDGET_WARNING_THRESHOLD * 100}%`,
      percentUsed: percentUsed.toFixed(1),
    });

    // Return warning info so it can be sent to client
    return {
      type: 'budget_warning' as const,
      currentCost,
      limit: MONTHLY_BUDGET_USD,
      percentUsed,
      threshold: BUDGET_WARNING_THRESHOLD * 100,
    } as any;
  }
}
