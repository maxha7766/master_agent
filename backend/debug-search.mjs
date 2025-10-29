/**
 * Debug the hybrid_search function
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== Debugging Hybrid Search ===\n');

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

// Step 1: Check if chunks exist for this user
console.log('Step 1: Checking chunks...');
const { data: userChunks, error: chunksError } = await supabase
  .from('chunks')
  .select('id, content, user_id, embedding')
  .eq('user_id', userId)
  .limit(3);

if (chunksError) {
  console.error('Error:', chunksError);
} else {
  console.log(`  Found ${userChunks.length} chunks for user`);
  if (userChunks.length > 0) {
    console.log(`  Sample chunk:`);
    console.log(`    ID: ${userChunks[0].id}`);
    console.log(`    User ID: ${userChunks[0].user_id}`);
    console.log(`    Content length: ${userChunks[0].content?.length || 0}`);
    console.log(`    Embedding type: ${typeof userChunks[0].embedding}`);
    console.log(`    Embedding is array: ${Array.isArray(userChunks[0].embedding)}`);
    console.log(`    Embedding length: ${Array.isArray(userChunks[0].embedding) ? userChunks[0].embedding.length : 'N/A'}`);
  }
}

// Step 2: Test direct vector search (bypass hybrid function)
console.log('\nStep 2: Testing direct vector similarity...');
const testEmbedding = Array(1536).fill(0.01);

// Try using Supabase's rpc for direct vector search
const { data: directResults, error: directError } = await supabase.rpc('match_chunks', {
  query_embedding: testEmbedding,
  match_user_id: userId,
  match_count: 5
}).catch(() => ({ data: null, error: 'match_chunks function not found' }));

if (directError) {
  console.log(`  match_chunks not available: ${directError}`);
} else {
  console.log(`  Direct search found ${directResults?.length || 0} results`);
}

// Step 3: Test keyword search
console.log('\nStep 3: Testing keyword search...');
const { data: keywordResults, error: keywordError } = await supabase
  .from('chunks')
  .select('id, content')
  .eq('user_id', userId)
  .textSearch('content', 'baseball')
  .limit(5);

if (keywordError) {
  console.log(`  Error: ${keywordError.message}`);
} else {
  console.log(`  Found ${keywordResults?.length || 0} results with keyword search`);
}

// Step 4: Test hybrid_search with detailed logging
console.log('\nStep 4: Testing hybrid_search function...');
const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_search', {
  query_embedding: JSON.stringify(testEmbedding),
  query_text: 'baseball',
  match_user_id: userId,
  match_count: 5,
  vector_weight: 0.7,
  keyword_weight: 0.3
});

if (hybridError) {
  console.log('  Error:', hybridError);
} else {
  console.log(`  Found ${hybridResults?.length || 0} results`);
  if (hybridResults && hybridResults.length > 0) {
    console.log('  First result:', hybridResults[0]);
  }
}

console.log('\n=== Debug Complete ===');
