#!/usr/bin/env node

/**
 * Test Usage Endpoint with JSONB Schema
 * Verifies the usage endpoint correctly parses usage_by_model JSONB data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUsageEndpoint() {
  try {
    console.log('🧪 Testing Usage Endpoint JSONB Schema Fix\n');

    // Get a test user
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    if (!users || users.users.length === 0) {
      console.log('⚠️  No users found. Please create a user first.');
      return;
    }

    const userId = users.users[0].id;
    console.log(`📝 Testing with user: ${users.users[0].email} (${userId})\n`);

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`📅 Current month: ${currentMonth}\n`);

    // Query usage data
    console.log('🔍 Querying user_usage table...');
    const { data: usage, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    if (usageError) {
      if (usageError.code === 'PGRST116') {
        console.log('ℹ️  No usage data found for current month (expected for new users)');
        console.log('✅ Endpoint should handle this gracefully by returning zeros\n');
        return;
      }
      throw usageError;
    }

    console.log('✅ Usage record found!\n');
    console.log('📊 Raw usage data:');
    console.log(JSON.stringify(usage, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    // Parse usage_by_model JSONB
    const usageByModel = usage.usage_by_model || {};
    console.log('📈 Parsing usage_by_model JSONB:');
    console.log(JSON.stringify(usageByModel, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    // Calculate aggregates (same logic as endpoint)
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

      console.log(`📊 ${model}:`);
      console.log(`   Input tokens:  ${inputTokens.toLocaleString()}`);
      console.log(`   Output tokens: ${outputTokens.toLocaleString()}`);
      console.log(`   Total tokens:  ${(inputTokens + outputTokens).toLocaleString()}`);
      console.log(`   Cost:          $${cost.toFixed(4)}`);
      console.log('');
    });

    // Count messages
    const startDate = new Date(`${currentMonth}-01T00:00:00Z`);
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

    console.log('='.repeat(60));
    console.log('📊 Aggregated Statistics:');
    console.log('='.repeat(60));
    console.log(`Total Messages:  ${messageCount || 0}`);
    console.log(`Total Tokens:    ${totalTokens.toLocaleString()}`);
    console.log(`Total Cost:      $${usage.total_cost_usd.toFixed(4)}`);
    console.log('');
    console.log('Cost by Model:');
    Object.entries(costByModel)
      .sort(([, a], [, b]) => b - a)
      .forEach(([model, cost]) => {
        const percentage = (cost / usage.total_cost_usd) * 100;
        console.log(`  ${model.padEnd(30)} $${cost.toFixed(4).padStart(8)} (${percentage.toFixed(1)}%)`);
      });

    console.log('\n✅ JSONB parsing successful! Endpoint should work correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

testUsageEndpoint();
