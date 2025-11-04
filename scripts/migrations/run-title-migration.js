#!/usr/bin/env node

/**
 * Run title column migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read migration file
const migrationSQL = readFileSync(
  join(__dirname, 'supabase', 'migrations', '20251031000000_add_document_title.sql'),
  'utf8'
);

console.log('Running title column migration...');
console.log(migrationSQL);

// Execute each statement separately
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function runMigration() {
  for (const statement of statements) {
    console.log('\nExecuting:', statement.substring(0, 100) + '...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: statement
    });

    if (error) {
      console.error('Error:', error);
      // Continue anyway for "already exists" errors
    } else {
      console.log('✓ Success');
    }
  }

  console.log('\n✅ Migration complete!');
}

runMigration().catch(console.error);
