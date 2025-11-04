import { supabase } from './src/models/database.js';

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('Checking SEC football document...\n');

// Check SEC football document
const { data: secDocs, error: secError } = await supabase
  .from('documents')
  .select('id, file_name, user_id, chunk_count, status')
  .eq('user_id', userId)
  .ilike('file_name', '%SEC%');

console.log('SEC Football documents for user:');
console.log(JSON.stringify(secDocs, null, 2));

if (secDocs && secDocs.length > 0) {
  const docId = secDocs[0].id;
  console.log(`\nChecking chunks for document ${docId}...`);

  // Check chunks
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('id, content, user_id, chunk_index')
    .eq('document_id', docId)
    .eq('user_id', userId)
    .order('chunk_index', { ascending: true })
    .limit(3);

  console.log('\nFirst 3 chunks:');
  chunks?.forEach(chunk => {
    console.log(`\nChunk ${chunk.chunk_index}:`);
    console.log(`User ID: ${chunk.user_id}`);
    console.log(`Content preview: ${chunk.content.substring(0, 200)}...`);
  });

  // Check if embedding exists
  const { data: embeddingCheck } = await supabase
    .from('document_chunks')
    .select('id, embedding')
    .eq('document_id', docId)
    .not('embedding', 'is', null)
    .limit(1);

  console.log(`\n✓ Chunks with embeddings: ${embeddingCheck?.length || 0}`);
}

// Check all documents to see what we have
const { data: allDocs } = await supabase
  .from('documents')
  .select('id, file_name, user_id, chunk_count, status')
  .eq('user_id', userId)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\n\nAll recent completed documents:');
allDocs?.forEach((doc, i) => {
  console.log(`${i + 1}. ${doc.file_name} (${doc.chunk_count} chunks)`);
});

process.exit(0);
