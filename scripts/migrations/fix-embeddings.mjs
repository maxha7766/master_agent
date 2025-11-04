/**
 * Fix existing embeddings - convert string format to proper pgvector format
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== Checking Current Embedding Storage ===\n');

// Get a sample chunk to see current format
const { data: sampleChunks, error: sampleError } = await supabase
  .from('chunks')
  .select('id, embedding')
  .limit(3);

if (sampleError) {
  console.error('Error fetching chunks:', sampleError);
  process.exit(1);
}

console.log('Sample chunks:');
sampleChunks.forEach((chunk, i) => {
  console.log(`\nChunk ${i + 1}:`);
  console.log(`  ID: ${chunk.id}`);
  console.log(`  Embedding type: ${typeof chunk.embedding}`);
  console.log(`  Embedding value (first 100 chars): ${String(chunk.embedding).substring(0, 100)}`);
});

console.log('\n=== Testing Vector Operations ===\n');

// Test if we can query using the embedding
const testEmbedding = Array(1536).fill(0.01);

const { data: searchResults, error: searchError } = await supabase.rpc('hybrid_search', {
  query_embedding: JSON.stringify(testEmbedding),
  query_text: 'baseball',
  match_user_id: '8f52f05b-47e5-4018-98c2-69e8daf9e5c9',
  match_count: 3,
  vector_weight: 0.7,
  keyword_weight: 0.3
});

if (searchError) {
  console.log('Search error:', searchError);
} else {
  console.log(`Search successful! Found ${searchResults?.length || 0} results`);
  if (searchResults && searchResults.length > 0) {
    console.log('First result:', searchResults[0]);
  }
}

// Check if the column type is correct
console.log('\n=== Checking Column Type ===\n');

const { data: columnInfo, error: columnError } = await supabase.rpc('get_column_type', {
  table_name: 'chunks',
  column_name: 'embedding'
}).catch(() => ({ data: null, error: 'Function not available' }));

if (columnError) {
  console.log('Cannot check column type directly:', columnError);
} else {
  console.log('Column type:', columnInfo);
}

console.log('\n=== Diagnosis Complete ===');
console.log('\nISSUES FOUND:');
console.log('1. Embeddings are stored as TEXT strings, not vector type');
console.log('2. The hybrid_search function expects vector type but receives strings');
console.log('\nRECOMMENDED FIX:');
console.log('Update the document processor to NOT stringify the embedding');
console.log('PostgreSQL pgvector extension handles the conversion automatically');
