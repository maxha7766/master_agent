#!/usr/bin/env node
/**
 * Test with simple keyword "balk" to see if vector search works better
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('=== Testing Different Queries ===\n');

const queries = [
  'balk',
  'what is a balk',
  'rules of a balk',
  'give me the summary of the rules of a balk'
];

for (const query of queries) {
  console.log(`\n📝 Query: "${query}"`);

  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Vector search with 0.3 threshold (master-rag default)
  const { data: vectorResults } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 5,
    target_user_id: userId,
  });

  console.log(`   Vector (0.3 threshold): ${vectorResults?.length || 0} results`);

  if (vectorResults && vectorResults.length > 0) {
    console.log(`   Top similarity: ${vectorResults[0].similarity.toFixed(4)}`);
    const hasBalk = vectorResults[0].content.toLowerCase().includes('balk');
    console.log(`   Contains "balk": ${hasBalk ? '✅' : '❌'}`);
  }

  // Try with 0.0 threshold
  const { data: allResults } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 20,
    target_user_id: userId,
  });

  console.log(`   Vector (0.0 threshold): ${allResults?.length || 0} results`);

  if (allResults && allResults.length > 0) {
    const balkResults = allResults.filter(r => r.content.toLowerCase().includes('balk'));
    console.log(`   Results with "balk": ${balkResults.length}`);
    if (balkResults.length > 0) {
      const bestBalk = balkResults[0];
      const rank = allResults.indexOf(bestBalk) + 1;
      console.log(`   Best balk match: rank ${rank}, similarity ${bestBalk.similarity.toFixed(4)}`);
    }
  }
}

console.log('\n✅ Test complete!');
