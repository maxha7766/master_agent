/**
 * Add sources_used column to messages table
 * Run this with: node run-sources-migration.js
 */

import { supabase } from './src/models/database.js';

async function runMigration() {
  console.log('🔄 Adding sources_used column to messages table...\n');

  try {
    // The SQL statements to execute
    const statements = [
      {
        name: 'Add sources_used column',
        sql: 'ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sources_used JSONB'
      },
      {
        name: 'Create GIN index on sources_used',
        sql: 'CREATE INDEX IF NOT EXISTS idx_messages_sources_used ON public.messages USING gin(sources_used)'
      },
      {
        name: 'Add column comment',
        sql: "COMMENT ON COLUMN public.messages.sources_used IS 'JSONB metadata tracking which documents were used to generate this response'"
      }
    ];

    // Execute each statement using raw SQL
    for (const stmt of statements) {
      console.log(`Executing: ${stmt.name}...`);
      const { error } = await supabase.rpc('exec', { sql: stmt.sql });

      if (error) {
        console.log(`⚠️  Could not execute via RPC: ${error.message}`);
        console.log('   This is normal - migration needs to be run manually in Supabase SQL Editor\n');
      }
    }

    // Try to verify by querying the column
    console.log('📋 Verifying migration...');
    const { data, error } = await supabase
      .from('messages')
      .select('id, sources_used')
      .limit(1);

    if (error) {
      console.log('\n❌ Column not yet created');
      console.log('\n💡 Please run this SQL manually in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/omjwoyyhpdawjxsbpamc/sql/new\n');
      console.log('-- Add sources_used column to messages table');
      console.log('ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sources_used JSONB;\n');
      console.log('-- Create index');
      console.log('CREATE INDEX IF NOT EXISTS idx_messages_sources_used ON public.messages USING gin(sources_used);\n');
      console.log('-- Add comment');
      console.log("COMMENT ON COLUMN public.messages.sources_used IS 'JSONB metadata tracking which documents were used to generate this response';\n");
    } else {
      console.log('✅ Migration successful!');
      console.log('✅ sources_used column exists and is ready to use\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nPlease run the migration manually in Supabase SQL Editor');
  }
}

runMigration();
