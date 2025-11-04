#!/usr/bin/env node
/**
 * Test RAG Search in Production
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('='.repeat(60));
console.log('RAG SEARCH TEST');
console.log('='.repeat(60));

// Test 1: Count total chunks
console.log('\n1. Counting chunks for user...');
const { data: allChunks, error: countError } = await supabase
  .from('chunks')
  .select('id', { count: 'exact' })
  .eq('user_id', USER_ID);

if (countError) {
  console.log('❌ Error:', countError.message);
} else {
  console.log(`✅ User has ${allChunks.length} chunks`);
}

// Test 2: Try to get a few chunks
console.log('\n2. Fetching sample chunks...');
const { data: sampleChunks, error: sampleError } = await supabase
  .from('chunks')
  .select('id, document_id, content, chunk_index')
  .eq('user_id', USER_ID)
  .limit(3);

if (sampleError) {
  console.log('❌ Error:', sampleError.message);
} else {
  console.log(`✅ Fetched ${sampleChunks.length} sample chunks`);
  sampleChunks.forEach((chunk, i) => {
    console.log(`   ${i + 1}. Chunk ${chunk.chunk_index}: ${chunk.content.substring(0, 100)}...`);
  });
}

// Test 3: Check if embeddings exist
console.log('\n3. Checking embeddings...');
const { data: embeddingChunk, error: embError } = await supabase
  .from('chunks')
  .select('id, embedding')
  .eq('user_id', USER_ID)
  .not('embedding', 'is', null)
  .limit(1);

if (embError) {
  console.log('❌ Error:', embError.message);
} else if (embeddingChunk.length === 0) {
  console.log('⚠️  No embeddings found - RAG search will not work!');
  console.log('   Documents need to be reprocessed to generate embeddings');
} else {
  console.log('✅ Embeddings exist');
  console.log(`   Sample embedding dimension: ${embeddingChunk[0].embedding?.length || 'unknown'}`);
}

// Test 4: Try a simple search function
console.log('\n4. Testing search function...');
const testQuery = 'mortgage rates';

try {
  // This simulates what the RAG agent does
  const { data: searchResults, error: searchError } = await supabase.rpc(
    'hybrid_search',
    {
      query_text: testQuery,
      query_embedding: new Array(1536).fill(0), // Dummy embedding for test
      match_count: 5,
      p_user_id: USER_ID
    }
  );

  if (searchError) {
    console.log('❌ Search function error:', searchError.message);
    console.log('   This might mean the hybrid_search RPC function is missing');
  } else {
    console.log(`✅ Search function works! Found ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log('   Top result:', searchResults[0].content.substring(0, 100));
    }
  }
} catch (error) {
  console.log('❌ Search function error:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('DIAGNOSIS');
console.log('='.repeat(60));

if (allChunks.length === 0) {
  console.log('\n❌ PROBLEM: No chunks found');
  console.log('   Solution: Documents need to be uploaded and processed');
} else if (!embeddingChunk || embeddingChunk.length === 0) {
  console.log('\n❌ PROBLEM: Chunks exist but no embeddings');
  console.log('   Solution: Need to regenerate embeddings for existing documents');
  console.log('   This requires running the document processor on existing docs');
} else {
  console.log('\n✅ Knowledge base appears to be set up correctly');
  console.log('   If agent is not working, check:');
  console.log('   1. Backend logs for errors');
  console.log('   2. WebSocket connection in frontend');
  console.log('   3. Agent routing logic');
}

console.log('\n' + '='.repeat(60));
