import { supabase } from './src/models/database.js';

console.log('Adding title column to documents table...\n');

// Add column
const { error: error1 } = await supabase.rpc('exec_sql', {
  sql_query: 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS title VARCHAR(500);'
});

if (error1) {
  console.error('Error adding column:', error1);
} else {
  console.log('✓ Title column added');
}

// Set title = file_name for existing documents
const { error: error2 } = await supabase.rpc('exec_sql', {
  sql_query: `UPDATE documents SET title = file_name WHERE title IS NULL;`
});

if (error2) {
  console.error('Error updating existing documents:', error2);
} else {
  console.log('✓ Existing documents updated');
}

console.log('\n✅ Migration complete!');
process.exit(0);
