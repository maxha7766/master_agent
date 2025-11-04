#!/usr/bin/env node
/**
 * End-to-end RAG test
 * Tests the complete pipeline: intent classification -> hybrid search -> RAG response
 */

import dotenv from 'dotenv';
dotenv.config();

// Import our services
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Dynamically import ESM modules
const { classifyIntent } = await import('./src/agents/master/intentClassifier.js');
const { vectorSearchService } = await import('./src/services/rag/search.js');
const { ragAgent } = await import('./src/agents/rag/index.js');

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
const query = 'give me the summary of the rules of a balk';

console.log('=== End-to-End RAG Test ===\n');
console.log(`Query: "${query}"\n`);

try {
  // Step 1: Intent Classification
  console.log('📋 Step 1: Classifying intent...');
  const intentResult = await classifyIntent(query, []);
  console.log(`   Intent: ${intentResult.intent}`);
  console.log(`   Confidence: ${intentResult.confidence}`);
  console.log(`   Reasoning: ${intentResult.reasoning}\n`);

  // Step 2: Hybrid Search
  console.log('🔍 Step 2: Running hybrid search...');
  const searchResults = await vectorSearchService.search(query, userId, {
    topK: 5,
    vectorThreshold: 0.01,
    textThreshold: 0.001,
    minRelevanceScore: 0.001,
    useReranking: true,
  });

  console.log(`   Found ${searchResults.length} results`);
  if (searchResults.length > 0) {
    console.log(`   Top result relevance: ${searchResults[0].relevanceScore.toFixed(4)}`);
    console.log(`   Content preview: ${searchResults[0].content.substring(0, 100)}...\n`);
  } else {
    console.log('   ⚠️  No results found!\n');
  }

  // Step 3: RAG Response Generation
  console.log('🤖 Step 3: Generating RAG response...');
  const response = await ragAgent.generateResponse(query, userId, {
    topK: 5,
    minRelevanceScore: 0.001,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    includeSources: true,
  });

  console.log('\n' + '='.repeat(80));
  console.log('📝 FINAL RESPONSE:');
  console.log('='.repeat(80));
  console.log(response.content);
  console.log('\n' + '='.repeat(80));
  console.log(`📚 Sources: ${response.sources.length}`);
  response.sources.forEach((source, i) => {
    console.log(`\n[${i + 1}] ${source.fileName} (relevance: ${source.relevanceScore.toFixed(4)})`);
    console.log(`    ${source.excerpt}`);
  });
  console.log('\n' + '='.repeat(80));
  console.log(`⚡ Metadata:`);
  console.log(`   Model: ${response.metadata.model}`);
  console.log(`   Chunks: ${response.metadata.chunksRetrieved}`);
  console.log(`   Tokens: ${response.metadata.tokensUsed || 'N/A'}`);
  console.log(`   Latency: ${response.metadata.latencyMs}ms`);
  console.log('\n✅ Test complete!');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
