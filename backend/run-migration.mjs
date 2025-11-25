import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

const migrationSQL = readFileSync('./migrations/005_create_memory_tables.sql', 'utf-8');

console.log('Running memory system migration...\n');

const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

if (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} else {
  console.log('✅ Migration completed successfully!');
  console.log('\nCreated tables:');
  console.log('  - user_memories');
  console.log('  - entities');
  console.log('  - entity_relationships');
  console.log('  - conversation_summaries');
  process.exit(0);
}
