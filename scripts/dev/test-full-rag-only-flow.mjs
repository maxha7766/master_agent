/**
 * Test the FULL end-to-end RAG-only flow
 * This simulates exactly what happens when a user sends a query
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullFlow() {
  console.log('=== TESTING FULL RAG-ONLY FLOW ===\n');

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User ID:', userId);

  // Step 1: Check available documents (like orchestrator does)
  console.log('\n=== STEP 1: Query Available Documents ===');
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, file_type, row_count, column_count, chunk_count, summary')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (docsError) {
    console.error('Error querying documents:', docsError);
    return;
  }

  console.log(`Documents found: ${documents.length}`);
  documents.forEach((doc) => {
    const isTabular = !!(doc.row_count && doc.row_count > 0);
    if (isTabular) {
      console.log(`  - ${doc.file_name} (Tabular: ${doc.row_count} rows)`);
    } else {
      console.log(`  - ${doc.file_name} (Text: ${doc.chunk_count} chunks)`);
    }
  });

  // Step 2: Decide which sub-agents to use
  console.log('\n=== STEP 2: Decide Sub-Agents ===');
  const hasTextDocs = documents.some((d) => !d.row_count && d.chunk_count);
  const hasTabularDocs = documents.some((d) => d.row_count && d.row_count > 0);

  console.log(`Has text docs: ${hasTextDocs}`);
  console.log(`Has tabular docs: ${hasTabularDocs}`);

  const query = 'tell me about Vito in the Godfather';
  console.log(`\nQuery: "${query}"`);

  // For this query, we expect useRAG = true
  const useRAG = true;
  const useTabular = false;

  console.log(`Decision: useRAG=${useRAG}, useTabular=${useTabular}`);

  // Step 3: Retrieve RAG context (simulating what ragAgent.retrieveContext does)
  if (useRAG) {
    console.log('\n=== STEP 3: Retrieve RAG Context ===');

    // Import the actual search service
    const { default: moduleImport } = await import('./dist/services/rag/search.js');
    const { vectorSearchService } = moduleImport;

    const chatSettings = {
      ragOnlyMode: true,
      topK: 5,
      minRelevanceScore: 0.0,
    };

    console.log('Chat settings:', chatSettings);

    try {
      const searchResults = await vectorSearchService.search(query, userId, {
        topK: chatSettings.topK,
        minRelevanceScore: chatSettings.minRelevanceScore,
      });

      console.log(`\nSearch results: ${searchResults.length}`);

      if (searchResults.length > 0) {
        console.log('\nTop 5 results:');
        searchResults.slice(0, 5).forEach((r, i) => {
          console.log(`\n[${i + 1}] Score: ${r.relevanceScore.toFixed(6)}`);
          console.log(`Document: ${r.fileName}`);
          console.log(`Content: ${r.content.substring(0, 150)}...`);
        });
      } else {
        console.log('NO RESULTS RETURNED!');
      }

      // Step 4: Check the RAG-only mode logic
      console.log('\n=== STEP 4: RAG-Only Mode Check ===');
      const hasRetrievedData = searchResults && searchResults.length > 0;

      console.log(`hasRetrievedData: ${hasRetrievedData}`);

      if (chatSettings.ragOnlyMode && !hasRetrievedData) {
        console.log('\n❌ WOULD FAIL: RAG-only mode enabled but no data retrieved');
        console.log('Would return: "I searched your documents but couldn\'t find relevant information..."');
      } else {
        console.log('\n✅ WOULD SUCCEED: Has data to synthesize response');
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  }
}

testFullFlow().catch(console.error);
