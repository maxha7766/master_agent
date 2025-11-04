import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

console.log('=== STEP 1: Check Documents ===');
const { data: docs, error: docsError } = await supabase
  .from('documents')
  .select('id, file_name, status, chunk_count, created_at')
  .order('created_at', { ascending: false })
  .limit(1);

if (docsError) {
  console.error('Error:', docsError);
  process.exit(1);
}

console.log('Latest document:', docs[0]);

if (!docs || docs.length === 0) {
  console.log('No documents found - upload a document first');
  process.exit(0);
}

const docId = docs[0].id;
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9'; // Your user ID from logs

console.log('\n=== STEP 2: Check Chunks ===');
const { data: chunks, error: chunksError } = await supabase
  .from('chunks')
  .select('id, content, embedding, chunk_index')
  .eq('document_id', docId)
  .limit(3);

if (chunksError) {
  console.error('Error:', chunksError);
} else {
  console.log(`Found ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    console.log(`\nChunk ${i + 1}:`);
    console.log('  Content preview:', chunk.content.substring(0, 100));
    console.log('  Embedding type:', typeof chunk.embedding);
    console.log('  Embedding value:', Array.isArray(chunk.embedding) ? 'Array' : chunk.embedding?.substring(0, 50));
  });
}

console.log('\n=== STEP 3: Test Vector Search ===');
// Try a simple vector search with a dummy embedding
const testEmbedding = new Array(1536).fill(0.1);

const { data: searchResults, error: searchError } = await supabase
  .rpc('match_chunks', {
    query_embedding: testEmbedding,
    match_user_id: userId,
    match_count: 5
  });

if (searchError) {
  console.error('Vector search error:', searchError);
  console.log('This function might not exist - checking hybrid_search instead...');

  const { data: hybridResults, error: hybridError } = await supabase
    .rpc('hybrid_search', {
      query_embedding: testEmbedding,
      query_text: 'baseball',
      match_user_id: userId,
      match_count: 5
    });

  if (hybridError) {
    console.error('Hybrid search error:', hybridError);
  } else {
    console.log('Hybrid search results:', hybridResults?.length || 0);
  }
} else {
  console.log('Vector search results:', searchResults?.length || 0);
}

console.log('\n=== STEP 4: Check Embedding Data Type in DB ===');
const { data: rawChunk, error: rawError } = await supabase
  .from('chunks')
  .select('embedding')
  .eq('document_id', docId)
  .limit(1)
  .single();

if (rawError) {
  console.error('Error:', rawError);
} else {
  console.log('Raw embedding from DB:');
  console.log('  Type:', typeof rawChunk.embedding);
  if (typeof rawChunk.embedding === 'string') {
    console.log('  First 200 chars:', rawChunk.embedding.substring(0, 200));
    console.log('  ⚠️  PROBLEM: Embedding is a STRING, should be a vector/array');
  } else if (Array.isArray(rawChunk.embedding)) {
    console.log('  Length:', rawChunk.embedding.length);
    console.log('  First 5 values:', rawChunk.embedding.slice(0, 5));
    console.log('  ✅ Embedding is properly formatted');
  } else {
    console.log('  Value:', rawChunk.embedding);
  }
}
