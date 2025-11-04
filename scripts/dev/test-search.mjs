import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('=== Testing RAG Search ===');

// First, check if we have documents
const { data: docs, error: docsError } = await supabase
  .from('documents')
  .select('id, file_name, chunk_count')
  .eq('user_id', userId)
  .eq('status', 'completed');

if (docsError) {
  console.error('Error fetching documents:', docsError);
  process.exit(1);
}

console.log('\nDocuments found:', docs.length);
docs.forEach(doc => {
  console.log(`- ${doc.file_name} (${doc.chunk_count} chunks)`);
});

// Check chunks
const { data: chunks, error: chunksError } = await supabase
  .from('chunks')
  .select('id, document_id, content')
  .eq('user_id', userId)
  .limit(3);

if (chunksError) {
  console.error('Error fetching chunks:', chunksError);
} else {
  console.log(`\nTotal chunks sample: ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.log(`\nChunk ${i + 1}:`);
    console.log('Content:', chunk.content.substring(0, 100) + '...');
  });
}

// Now test the hybrid search with a simple query embedding
console.log('\n=== Testing Hybrid Search ===');

// Generate a test embedding (1536 dimensions of small random values)
const testEmbedding = Array(1536).fill(0).map(() => Math.random() * 0.01);

console.log('Test embedding length:', testEmbedding.length);
console.log('Test embedding type:', Array.isArray(testEmbedding) ? 'Array' : typeof testEmbedding);

try {
  const { data: searchResults, error: searchError } = await supabase
    .rpc('hybrid_search', {
      query_embedding: testEmbedding,
      query_text: 'baseball balk rules',
      match_user_id: userId,
      match_count: 5,
      vector_weight: 0.7,
      keyword_weight: 0.3
    });

  if (searchError) {
    console.error('\n❌ Hybrid search error:', searchError);
    console.error('Error details:', JSON.stringify(searchError, null, 2));
  } else {
    console.log('\n✅ Hybrid search successful!');
    console.log('Results found:', searchResults ? searchResults.length : 0);

    if (searchResults && searchResults.length > 0) {
      console.log('\nFirst result:');
      console.log('- Relevance score:', searchResults[0].relevance_score);
      console.log('- Content preview:', searchResults[0].content.substring(0, 100) + '...');
    }
  }
} catch (error) {
  console.error('\n❌ Exception during search:', error.message);
}
