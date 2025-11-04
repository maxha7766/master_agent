#!/usr/bin/env node

/**
 * Apply Budget Settings Migration
 * Adds monthly_budget_limit column to user_settings table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('📋 Applying budget settings migration...\n');

    // Read migration file
    const migrationPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'supabase',
      'migrations',
      '20251102000001_add_budget_settings.sql'
    );

    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct approach if RPC doesn't exist
      console.log('⚠️  RPC method not available, trying direct approach...');

      // Split into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error('❌ Migration failed:', stmtError.message);
            console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
            console.log(migrationSQL);
            process.exit(1);
          }
        }
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📊 Verifying column exists...');

    // Verify the column was added
    const { data, error: verifyError } = await supabase
      .from('user_settings')
      .select('monthly_budget_limit')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
      console.log(migrationSQL);
      process.exit(1);
    }

    console.log('✅ Column verified successfully!');
    console.log('\n🎉 Migration complete! You can now use the settings page.');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'supabase', 'migrations', '20251102000001_add_budget_settings.sql'),
      'utf8'
    ));
    process.exit(1);
  }
}

applyMigration();
