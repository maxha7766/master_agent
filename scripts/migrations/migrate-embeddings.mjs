/**
 * Migrate existing string embeddings to proper vector format
 * This script converts TEXT string embeddings to vector(1536) type
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== Migrating Embeddings from String to Vector Format ===\n');

// Get all chunks with string embeddings
const { data: chunks, error: fetchError } = await supabase
  .from('chunks')
  .select('id, embedding')
  .not('embedding', 'is', null);

if (fetchError) {
  console.error('Error fetching chunks:', fetchError);
  process.exit(1);
}

console.log(`Found ${chunks.length} chunks to migrate\n`);

let successCount = 0;
let errorCount = 0;

// Update each chunk
for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];

  try {
    // Parse the string embedding to array
    let embeddingArray;
    if (typeof chunk.embedding === 'string') {
      // Remove brackets and split by comma
      embeddingArray = JSON.parse(chunk.embedding);
    } else {
      // Already an array
      embeddingArray = chunk.embedding;
    }

    // Update with array (Supabase will convert to vector)
    const { error: updateError } = await supabase
      .from('chunks')
      .update({ embedding: embeddingArray })
      .eq('id', chunk.id);

    if (updateError) {
      console.error(`  Error updating chunk ${chunk.id}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${chunks.length} chunks migrated`);
      }
    }
  } catch (error) {
    console.error(`  Error processing chunk ${chunk.id}:`, error.message);
    errorCount++;
  }
}

console.log(`\n=== Migration Complete ===`);
console.log(`  Success: ${successCount}`);
console.log(`  Errors: ${errorCount}`);

// Test if search now works
console.log('\n=== Testing Search After Migration ===\n');

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
    console.log('\nFirst result:');
    console.log(`  Document ID: ${searchResults[0].document_id}`);
    console.log(`  Content preview: ${searchResults[0].content.substring(0, 100)}...`);
    console.log(`  Relevance score: ${searchResults[0].relevance_score}`);
  }
}
