#!/usr/bin/env node
/**
 * Simple search test - just tests the database functions directly
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
const query = 'give me the summary of the rules of a balk';

console.log('=== Simple Search Test ===\n');
console.log(`Query: "${query}"\n`);

try {
  // Generate embedding
  console.log('🔢 Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-large',  // MUST match database embeddings!
    input: query,
    dimensions: 1536,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`✅ Generated ${queryEmbedding.length} dimensions\n`);

  // Test vector search with very low threshold
  console.log('🔍 Testing vector search...');
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 20,  // Get more results to see if relevant ones appear
    target_user_id: userId,
  });

  if (vectorError) {
    console.error('❌ Vector search error:', vectorError);
  } else {
    console.log(`✅ Vector search: ${vectorResults.length} results`);
    if (vectorResults.length > 0) {
      console.log(`   Top similarity: ${vectorResults[0].similarity.toFixed(4)}`);
      console.log(`   Content: ${vectorResults[0].content.substring(0, 150)}...`);

      // Check if any contain "balk"
      const balkResults = vectorResults.filter(r => r.content.toLowerCase().includes('balk'));
      console.log(`   Results containing "balk": ${balkResults.length}`);
      if (balkResults.length > 0) {
        console.log(`   Best balk result (rank ${vectorResults.indexOf(balkResults[0]) + 1}):`)
        console.log(`     Similarity: ${balkResults[0].similarity.toFixed(4)}`);
        console.log(`     Content: ${balkResults[0].content.substring(0, 200)}...\n`);
      } else {
        console.log(`   ⚠️  No results contain "balk" - embeddings may not be matching well\n`);
      }
    }
  }

  // Test fulltext search with very low threshold
  console.log('📝 Testing fulltext search...');
  const { data: textResults, error: textError } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 5,
    target_user_id: userId,
  });

  if (textError) {
    console.error('❌ Fulltext search error:', textError);
  } else {
    console.log(`✅ Fulltext search: ${textResults.length} results`);
    if (textResults.length > 0) {
      console.log(`   Top rank: ${textResults[0].rank.toFixed(4)}`);
      console.log(`   Content: ${textResults[0].content.substring(0, 150)}...\n`);
    }
  }

  // RRF Combination
  if (vectorResults.length > 0 || textResults.length > 0) {
    console.log('🔀 RRF Combination:');
    const k = 60;
    const scoreMap = new Map();

    vectorResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1.0 / (k + rank);
      scoreMap.set(result.id, {
        content: result.content,
        vectorScore: rrfScore,
        textScore: 0.0,
        combinedScore: rrfScore,
      });
    });

    textResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1.0 / (k + rank);
      const existing = scoreMap.get(result.id);

      if (existing) {
        existing.textScore = rrfScore;
        existing.combinedScore += rrfScore;
      } else {
        scoreMap.set(result.id, {
          content: result.content,
          vectorScore: 0.0,
          textScore: rrfScore,
          combinedScore: rrfScore,
        });
      }
    });

    const hybridResults = Array.from(scoreMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 5);

    console.log(`   Combined ${hybridResults.length} unique results`);
    console.log('\n📊 Top 3 Results:');
    hybridResults.slice(0, 3).forEach((result, i) => {
      console.log(`\n${i + 1}. Combined Score: ${result.combinedScore.toFixed(4)}`);
      console.log(`   Vector: ${result.vectorScore.toFixed(4)}, Text: ${result.textScore.toFixed(4)}`);
      console.log(`   ${result.content.substring(0, 150)}...`);
    });
  }

  console.log('\n✅ Test complete!');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
