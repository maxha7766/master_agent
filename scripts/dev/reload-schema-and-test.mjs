/**
 * Reload Supabase schema cache and test
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log('=== Reloading Schema ===\n');

// Reload the schema using Supabase API
try {
  const reloadResponse = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys/reload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    }
  );

  if (!reloadResponse.ok) {
    const errorText = await reloadResponse.text();
    console.log(`Schema reload response (${reloadResponse.status}): ${errorText}`);
  } else {
    console.log('Schema reload triggered\n');
  }
} catch (error) {
  console.log('Schema reload not available via this endpoint');
}

// Wait a moment for schema to reload
console.log('Waiting 3 seconds for schema cache to refresh...\n');
await new Promise(resolve => setTimeout(resolve, 3000));

// Test the function
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing hybrid_search...\n');

const testEmbedding = Array(1536).fill(0.01);
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

const { data, error } = await supabase.rpc('hybrid_search', {
  query_embedding: JSON.stringify(testEmbedding),
  query_text: 'baseball',
  match_user_id: userId,
  match_count: 5,
  vector_weight: 0.7,
  keyword_weight: 0.3
});

if (error) {
  console.log('Error:', error);
  console.log('\nTrying to call function with different parameter order...\n');

  // Try calling in positional order
  const { data: data2, error: error2 } = await supabase.rpc('hybrid_search', [
    JSON.stringify(testEmbedding),
    'baseball',
    userId,
    5,
    0.7,
    0.3
  ]);

  if (error2) {
    console.log('Positional params error:', error2);
  } else {
    console.log(`✓ Works with positional params! Found ${data2?.length || 0} results`);
  }
} else {
  console.log(`✓ hybrid_search works! Found ${data?.length || 0} results`);
  if (data && data.length > 0) {
    console.log('\nFirst result:');
    console.log(`  Chunk ID: ${data[0].chunk_id}`);
    console.log(`  Content: ${data[0].content?.substring(0, 150)}...`);
    console.log(`  Relevance Score: ${data[0].relevance_score}`);
  }
}

console.log('\n=== Done ===');
