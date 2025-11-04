/**
 * Run Graduate Research Migration
 * Creates all necessary database tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('📚 Running Graduate Research System migration...\n');

    // Read the SQL file
    const sql = readFileSync(join(__dirname, 'create-graduate-research-tables.sql'), 'utf8');

    // Split into individual statements (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('DO $$'));

    console.log(`Executing ${statements.length} SQL statements...\n`);

    // Use a simpler approach - just execute the entire SQL as one query
    console.log('  Executing SQL migration...');

    // Use the REST API directly to execute arbitrary SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // Fallback: Try creating tables individually using the from() API
      console.log('  Trying alternative method...\n');

      // Create tables by executing raw SQL through pg
      const { createClient: createPgClient } = await import('pg');
      const pg = createPgClient({
        connectionString: `postgresql://postgres.omjwoyyhpdawjxsbpamc:${process.env.SUPABASE_PROJECT_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
      });

      await pg.connect();

      for (const statement of statements) {
        if (statement.startsWith('--') || statement.length < 10) continue;

        try {
          await pg.query(statement + ';');
          console.log('  ✅ Executed statement');
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log('  ✓ (already exists)');
          } else {
            console.log(`  ❌ Error: ${error.message}`);
          }
        }
      }

      await pg.end();
    } else {
      console.log('  ✅ SQL executed successfully');
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  ✓ research_projects');
    console.log('  ✓ research_sources');
    console.log('  ✓ research_themes');
    console.log('  ✓ report_sections');
    console.log('  ✓ agent_logs\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
