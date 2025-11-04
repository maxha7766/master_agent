import { supabase } from './src/models/database.js';

console.log('Adding title column to conversations table...\n');

// Add column
const { error: error1 } = await supabase.rpc('exec_sql', {
  query: 'ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title VARCHAR(100);'
});

if (error1) {
  console.error('Error adding column:', error1);
} else {
  console.log('✓ Title column added');
}

// Add index
const { error: error2 } = await supabase.rpc('exec_sql', {
  query: 'CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(user_id, updated_at DESC);'
});

if (error2) {
  console.error('Error creating index:', error2);
} else {
  console.log('✓ Index created');
}

console.log('\n✅ Migration complete!');
process.exit(0);
