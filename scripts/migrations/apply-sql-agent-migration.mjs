#!/usr/bin/env node

/**
 * Apply SQL Agent Migration
 * Adds missing db_type and other columns to database_connections table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔧 Applying SQL Agent migration...\n');

    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20251101000000_add_sql_agent_schema.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file:', migrationPath);
    console.log('📏 SQL length:', migrationSql.length, 'characters\n');

    // Execute migration using exec_sql function
    const { data, error } = await supabase.rpc('exec_sql', { query: migrationSql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify db_type column exists now
    console.log('🔍 Verifying db_type column was added...\n');

    const { data: testConnection, error: selectError } = await supabase
      .from('database_connections')
      .select('id, name, db_type')
      .limit(1);

    if (selectError) {
      if (selectError.message.includes('db_type')) {
        console.error('❌ db_type column still missing!', selectError);
        process.exit(1);
      } else {
        console.log('⚠️  No connections exist yet (this is OK)');
      }
    } else {
      console.log('✅ db_type column exists and is queryable!');
    }

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
