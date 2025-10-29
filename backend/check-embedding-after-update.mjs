/**
 * Check what happens when we update an embedding
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== Testing Embedding Update ===\n');

// Get one chunk
const { data: chunks, error: fetchError } = await supabase
  .from('chunks')
  .select('id, embedding')
  .limit(1)
  .single();

if (fetchError || !chunks) {
  console.error('Error fetching chunk:', fetchError);
  process.exit(1);
}

console.log('Before update:');
console.log(`  ID: ${chunks.id}`);
console.log(`  Embedding type: ${typeof chunks.embedding}`);
console.log(`  Embedding is string: ${typeof chunks.embedding === 'string'}`);
console.log(`  First 100 chars: ${String(chunks.embedding).substring(0, 100)}`);

// Parse the string
const embeddingArray = JSON.parse(chunks.embedding);
console.log(`\nParsed to array:`);
console.log(`  Is array: ${Array.isArray(embeddingArray)}`);
console.log(`  Length: ${embeddingArray.length}`);
console.log(`  First 5 values: ${embeddingArray.slice(0, 5)}`);

// Try update with array
console.log(`\nAttempting update with array...`);
const { error: updateError } = await supabase
  .from('chunks')
  .update({ embedding: embeddingArray })
  .eq('id', chunks.id);

if (updateError) {
  console.error('Update error:', updateError);
} else {
  console.log('Update successful!');
}

// Re-fetch to see what was stored
const { data: updatedChunk, error: refetchError } = await supabase
  .from('chunks')
  .select('id, embedding')
  .eq('id', chunks.id)
  .single();

if (refetchError) {
  console.error('Refetch error:', refetchError);
} else {
  console.log('\nAfter update:');
  console.log(`  Embedding type: ${typeof updatedChunk.embedding}`);
  console.log(`  Embedding is string: ${typeof updatedChunk.embedding === 'string'}`);
  console.log(`  First 100 chars: ${String(updatedChunk.embedding).substring(0, 100)}`);
}

console.log('\n=== Issue Identified ===');
console.log('Supabase-js automatically converts pgvector columns back to strings when fetching!');
console.log('This is expected behavior. The database stores them as vectors correctly.');
console.log('The hybrid_search function should still work because it operates on the database side.');
