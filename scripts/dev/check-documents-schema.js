import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking documents and chunks table structure...\n');

// Try to insert a test document to see what columns exist
console.log('📋 Testing documents table...');
const testDoc = {
  user_id: '736afa3e-d74f-446b-acd1-bf96874e84b8',
  file_name: 'test.txt',
  file_size: 100,
  file_type: 'text/plain',
  storage_path: '/test/test.txt'
};

const { error: docError } = await supabase
  .from('documents')
  .insert(testDoc)
  .select();

if (docError) {
  console.log('Documents table structure needs updates:');
  console.log('Error:', docError.message);
  console.log('');

  if (docError.message.includes('column')) {
    console.log('❌ Missing columns in documents table');
    console.log('Migration needed!');
  }
} else {
  console.log('✅ Documents table has basic structure');

  // Clean up test
  await supabase
    .from('documents')
    .delete()
    .eq('file_name', 'test.txt');
}

console.log('\n📋 Testing chunks table...');

// Check if chunks table has embedding column
const testChunk = {
  document_id: '00000000-0000-0000-0000-000000000000',
  user_id: '736afa3e-d74f-446b-acd1-bf96874e84b8',
  content: 'test',
  position: 0
};

const { error: chunkError } = await supabase
  .from('chunks')
  .insert(testChunk)
  .select();

if (chunkError) {
  console.log('Chunks table structure:');
  console.log('Error:', chunkError.message);
  console.log('');

  if (chunkError.message.includes('embedding')) {
    console.log('❌ Missing embedding column (pgvector)');
    console.log('Migration needed!');
  } else if (chunkError.message.includes('foreign key')) {
    console.log('✅ Chunks table has foreign key constraints');
  }
} else {
  console.log('✅ Chunks table accepts basic inserts');

  // Clean up
  await supabase
    .from('chunks')
    .delete()
    .eq('content', 'test');
}

console.log('\n✅ Schema check complete!\n');
process.exit(0);
