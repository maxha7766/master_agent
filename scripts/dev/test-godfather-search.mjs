/**
 * Test Godfather Search
 * Tests if we can retrieve chunks about Vito from the Godfather document
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_PUBLIC
);

async function testGodfatherSearch() {
  console.log('Testing Godfather document search...\n');

  // First, list ALL documents
  const { data: allDocs, error: allDocsError } = await supabase
    .from('documents')
    .select('id, file_name, status, chunk_count, user_id')
    .order('created_at', { ascending: false });

  if (allDocsError) {
    console.error('Error listing documents:', allDocsError);
    return;
  }

  console.log(`\n=== ALL DOCUMENTS (${allDocs?.length || 0}) ===`);
  allDocs?.forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.file_name} (${doc.status}, chunks: ${doc.chunk_count})`);
  });
  console.log('');

  // Now find the Godfather document
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .ilike('file_name', '%godfather%');

  if (docsError) {
    console.error('Error finding Godfather document:', docsError);
    return;
  }

  console.log('Found documents:', docs);
  console.log('');

  if (!docs || docs.length === 0) {
    console.log('No Godfather document found!');
    return;
  }

  const godfatherDoc = docs[0];
  console.log(`Godfather Document: ${godfatherDoc.file_name}`);
  console.log(`Document ID: ${godfatherDoc.id}`);
  console.log(`User ID: ${godfatherDoc.user_id}`);
  console.log(`Chunk Count: ${godfatherDoc.chunk_count}`);
  console.log('');

  // Now search for chunks containing "Vito"
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', godfatherDoc.id)
    .ilike('content', '%vito%')
    .limit(5);

  if (chunksError) {
    console.error('Error searching chunks:', chunksError);
    return;
  }

  console.log(`Found ${chunks?.length || 0} chunks containing "Vito"`);
  console.log('');

  if (chunks && chunks.length > 0) {
    chunks.forEach((chunk, i) => {
      console.log(`\n--- Chunk ${i + 1} ---`);
      console.log(`Chunk ID: ${chunk.id}`);
      console.log(`Page: ${chunk.page_number}`);
      console.log(`Content Preview: ${chunk.content.substring(0, 200)}...`);
    });
  }

  // Now test vector search using match_documents function
  console.log('\n\n=== Testing Vector Search ===\n');

  // We need an embedding for "Vito Corleone"
  // For now, let's just test if the function exists
  const { data: vectorResults, error: vectorError } = await supabase.rpc(
    'match_documents',
    {
      query_embedding: new Array(1536).fill(0.1), // Dummy embedding
      match_threshold: 0.0,
      match_count: 5,
      target_user_id: godfatherDoc.user_id,
    }
  );

  if (vectorError) {
    console.error('Vector search error:', vectorError);
  } else {
    console.log(`Vector search returned ${vectorResults?.length || 0} results`);
  }

  // Test fulltext search
  console.log('\n\n=== Testing Fulltext Search ===\n');

  const { data: fulltextResults, error: fulltextError } = await supabase.rpc(
    'search_documents_fulltext',
    {
      search_query: 'Vito',
      match_threshold: 0.0,
      match_count: 10,
      target_user_id: godfatherDoc.user_id,
    }
  );

  if (fulltextError) {
    console.error('Fulltext search error:', fulltextError);
    console.error('Error details:', JSON.stringify(fulltextError, null, 2));
  } else {
    console.log(`Fulltext search returned ${fulltextResults?.length || 0} results`);
    if (fulltextResults && fulltextResults.length > 0) {
      console.log('\nFirst result:');
      console.log(JSON.stringify(fulltextResults[0], null, 2));
    }
  }
}

testGodfatherSearch().catch(console.error);
