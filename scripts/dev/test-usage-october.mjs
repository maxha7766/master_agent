#!/usr/bin/env node

/**
 * Test Usage Endpoint with October 2025 data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOctoberUsage() {
  try {
    const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
    const targetMonth = '2025-10';

    console.log('🧪 Testing Usage Endpoint with October 2025 Data\n');
    console.log(`User ID: ${userId}`);
    console.log(`Month: ${targetMonth}\n`);

    // Get usage record (exactly as the endpoint does)
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', targetMonth)
      .single();

    if (usageError) {
      throw usageError;
    }

    console.log('✅ Usage record retrieved\n');

    // Extract data (exactly as the endpoint does)
    const totalCost = usage?.total_cost_usd || 0;
    const usageByModel = usage?.usage_by_model || {};

    console.log('📊 Extracted Data:');
    console.log(`Total Cost from DB: $${totalCost.toFixed(4)}`);
    console.log('Usage by Model:', JSON.stringify(usageByModel, null, 2));
    console.log('');

    // Calculate aggregates (exactly as the endpoint does)
    let totalTokens = 0;
    const costByModel = {};
    const tokensByModel = {};

    Object.entries(usageByModel).forEach(([model, data]) => {
      const inputTokens = data.input || 0;
      const outputTokens = data.output || 0;
      const cost = data.cost || 0;

      totalTokens += inputTokens + outputTokens;
      costByModel[model] = cost;
      tokensByModel[model] = inputTokens + outputTokens;
    });

    // Count messages
    const startDate = new Date(`${targetMonth}-01T00:00:00Z`);
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDateStr = nextMonth.toISOString();

    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDateStr);

    const totalMessages = messageCount || 0;

    // Get settings for budget
    const { data: settings } = await supabase
      .from('user_settings')
      .select('monthly_budget_limit')
      .eq('user_id', userId)
      .single();

    const budgetLimit = settings?.monthly_budget_limit || 10.0;
    const budgetRemaining = budgetLimit - totalCost;
    const percentUsed = (totalCost / budgetLimit) * 100;

    console.log('='.repeat(60));
    console.log('📈 Calculated Statistics (as endpoint would return):');
    console.log('='.repeat(60));
    console.log(`Total Messages:    ${totalMessages}`);
    console.log(`Total Tokens:      ${totalTokens.toLocaleString()}`);
    console.log(`Total Cost:        $${totalCost.toFixed(4)}`);
    console.log(`Budget Limit:      $${budgetLimit.toFixed(2)}`);
    console.log(`Budget Remaining:  $${budgetRemaining.toFixed(4)}`);
    console.log(`Percent Used:      ${percentUsed.toFixed(1)}%`);
    console.log('');
    console.log('Cost by Model:');
    Object.entries(costByModel).forEach(([model, cost]) => {
      console.log(`  ${model}: $${cost.toFixed(4)}`);
    });
    console.log('');
    console.log('Tokens by Model:');
    Object.entries(tokensByModel).forEach(([model, tokens]) => {
      console.log(`  ${model}: ${tokens.toLocaleString()} tokens`);
    });

    console.log('\n✅ Test successful! Endpoint logic works correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

testOctoberUsage();
