/**
 * Run Graduate Research Migration
 * Creates all necessary database tables using pg
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

async function runMigration() {
  const client = new Client({
    connectionString: `postgresql://postgres.omjwoyyhpdawjxsbpamc:${process.env.SUPABASE_PROJECT_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('📚 Running Graduate Research System migration...\n');

    // Read the SQL file
    const sql = readFileSync(join(__dirname, 'create-graduate-research-tables.sql'), 'utf8');

    // Execute the entire SQL file
    console.log('  Executing SQL...');
    await client.query(sql);
    console.log('  ✅ SQL executed successfully\n');

    console.log('✅ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  ✓ research_projects');
    console.log('  ✓ research_sources');
    console.log('  ✓ research_themes');
    console.log('  ✓ report_sections');
    console.log('  ✓ agent_logs\n');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('\n✅ Tables already exist - migration complete!\n');
    } else {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runMigration();
