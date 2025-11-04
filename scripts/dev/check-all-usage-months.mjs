#!/usr/bin/env node

/**
 * Check all months with usage data
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

async function checkAllUsage() {
  try {
    // Get all usage records
    const { data: allUsage, error } = await supabase
      .from('user_usage')
      .select('*')
      .order('month', { ascending: false });

    if (error) throw error;

    if (!allUsage || allUsage.length === 0) {
      console.log('ℹ️  No usage data found in database');
      return;
    }

    console.log(`📊 Found ${allUsage.length} usage records:\n`);

    allUsage.forEach(record => {
      console.log(`📅 Month: ${record.month}`);
      console.log(`   User ID: ${record.user_id}`);
      console.log(`   Total Cost: $${record.total_cost_usd}`);
      console.log(`   Usage by Model:`, JSON.stringify(record.usage_by_model, null, 2));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllUsage();
