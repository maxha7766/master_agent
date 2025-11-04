#!/usr/bin/env node
/**
 * Test script for hybrid search implementation
 * Tests both vector and fulltext search functions
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
const testQuery = 'baseball balk rules';

console.log('=== Testing Hybrid Search Implementation ===\n');

// Step 1: Check documents
console.log('📁 Checking documents...');
const { data: docs, error: docsError } = await supabase
  .from('documents')
  .select('id, file_name, chunk_count')
  .eq('user_id', userId)
  .eq('status', 'completed');

if (docsError) {
  console.error('❌ Error fetching documents:', docsError);
  process.exit(1);
}

console.log(`✅ Found ${docs.length} documents:`);
docs.forEach(doc => {
  console.log(`   - ${doc.file_name} (${doc.chunk_count} chunks)`);
});

// Step 2: Generate query embedding
console.log('\n🔢 Generating query embedding...');
const embeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: testQuery,
});
const queryEmbedding = embeddingResponse.data[0].embedding;
console.log(`✅ Generated embedding (${queryEmbedding.length} dimensions)`);

// Step 3: Test vector search
console.log('\n🔍 Testing vector search (match_documents)...');
const { data: vectorResults, error: vectorError } = await supabase
  .rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 5,
    target_user_id: userId,
  });

if (vectorError) {
  console.error('❌ Vector search error:', vectorError);
  console.error('   Details:', JSON.stringify(vectorError, null, 2));
} else {
  console.log(`✅ Vector search successful: ${vectorResults?.length || 0} results`);
  if (vectorResults && vectorResults.length > 0) {
    console.log(`   Top result similarity: ${vectorResults[0].similarity.toFixed(4)}`);
    console.log(`   Content: ${vectorResults[0].content.substring(0, 100)}...`);
  }
}

// Step 4: Test fulltext search
console.log('\n📝 Testing fulltext search (search_documents_fulltext)...');
const { data: textResults, error: textError } = await supabase
  .rpc('search_documents_fulltext', {
    search_query: testQuery,
    match_threshold: 0.01,
    match_count: 5,
    target_user_id: userId,
  });

if (textError) {
  console.error('❌ Fulltext search error:', textError);
  console.error('   Details:', JSON.stringify(textError, null, 2));
} else {
  console.log(`✅ Fulltext search successful: ${textResults?.length || 0} results`);
  if (textResults && textResults.length > 0) {
    console.log(`   Top result rank: ${textResults[0].rank.toFixed(4)}`);
    console.log(`   Content: ${textResults[0].content.substring(0, 100)}...`);
  }
}

// Step 5: Test RRF combination (in JavaScript)
console.log('\n🔀 Testing RRF combination...');
if (vectorResults && textResults) {
  const k = 60;
  const scoreMap = new Map();

  // Process vector results
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

  // Process text results
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

  console.log(`✅ RRF combination complete: ${hybridResults.length} results`);
  console.log('\n📊 Top 3 hybrid results:');
  hybridResults.slice(0, 3).forEach((result, i) => {
    console.log(`\n${i + 1}. Score: ${result.combinedScore.toFixed(4)} (V: ${result.vectorScore.toFixed(4)}, T: ${result.textScore.toFixed(4)})`);
    console.log(`   ${result.content.substring(0, 150)}...`);
  });
}

console.log('\n✅ All tests complete!');
