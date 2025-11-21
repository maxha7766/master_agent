/**
 * Test Excel RAG Knowledge
 * Quick test to verify Excel documentation is accessible via RAG
 */

import { supabase } from '../src/models/database.js';
import { VectorSearchService } from '../src/services/rag/search.js';

async function testExcelRAG() {
  console.log('Testing Excel RAG knowledge...\n');

  // Get a test user ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    console.error('❌ No users found in database');
    return;
  }

  const userId = users[0].id;
  console.log(`Using user ID: ${userId}\n`);

  // Test query
  const query = 'How do I use VLOOKUP in Excel?';
  console.log(`Query: "${query}"\n`);

  // Initialize search service
  const searchService = new VectorSearchService();

  // Search for matching chunks
  console.log('Searching for matching chunks...');
  const results = await searchService.search(query, userId, {
    topK: 5,
    useReranking: false, // Disable reranking for simple test
  });

  console.log(`✓ Found ${results.length} results\n`);

  if (results.length > 0) {
    console.log('Top Results:');
    console.log('='.repeat(80));

    results.forEach((result, i) => {
      console.log(`\n${i + 1}. Content Preview:`);
      console.log(result.content.substring(0, 200) + '...');
      console.log(`   Source: ${result.metadata?.source_type || 'unknown'}`);
      console.log(`   Category: ${result.metadata?.function_category || result.metadata?.doc_category || 'unknown'}`);
      console.log(`   Similarity: ${result.similarityScore.toFixed(4)}`);
      console.log(`   File: ${result.fileName || 'unknown'}`);
    });

    console.log('\n' + '='.repeat(80));

    // Check if any results are from Excel knowledge
    const excelResults = results.filter(r =>
      r.metadata?.source_type === 'microsoft_docs' ||
      r.metadata?.source_type === 'third_party'
    );

    console.log(`\n✓ ${excelResults.length} of ${results.length} results are from Excel documentation`);
  } else {
    console.log('⚠️  No chunks found!');
  }

  // Also check if Excel chunks exist at all
  console.log('\n\nChecking Excel chunk statistics...');
  const { data: excelChunks, error: statsError } = await supabase
    .from('chunks')
    .select('id, metadata')
    .or('metadata->>source_type.eq.microsoft_docs,metadata->>source_type.eq.third_party')
    .not('metadata->>doc_category', 'is', null);

  if (statsError) {
    console.error('❌ Stats error:', statsError);
  } else {
    console.log(`✓ Total Excel chunks in database: ${excelChunks?.length || 0}`);
  }
}

testExcelRAG()
  .then(() => {
    console.log('\n✓ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
