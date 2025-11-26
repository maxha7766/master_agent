/**
 * Apply image fields migration to messages table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Applying image fields migration to messages table...\n');

try {
  const sql = readFileSync('src/database/migrations/006_add_image_fields_to_messages.sql', 'utf-8');

  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.log('Migration might have been applied directly. Checking columns...\n');

    // Try to query messages with image fields
    const { data: testData, error: testError } = await supabase
      .from('messages')
      .select('image_url, image_metadata')
      .limit(1);

    if (testError) {
      console.log('❌ ERROR: Columns still missing');
      console.log('Please run this SQL manually in Supabase SQL Editor:');
      console.log('\n' + sql);
      process.exit(1);
    }

    console.log('✅ Columns already exist!');
  } else {
    console.log('✅ Migration applied successfully!');
  }
} catch (err) {
  console.log('Running migration manually via ALTER TABLE...\n');

  // Try direct SQL execution
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql_string: `
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS image_metadata JSONB;
    `
  });

  if (alterError) {
    console.log('❌ Cannot apply via RPC. Please apply manually:');
    console.log('\nALTER TABLE messages');
    console.log('ADD COLUMN IF NOT EXISTS image_url TEXT,');
    console.log('ADD COLUMN IF NOT EXISTS image_metadata JSONB;');
    process.exit(1);
  }

  console.log('✅ Columns added successfully!');
}
