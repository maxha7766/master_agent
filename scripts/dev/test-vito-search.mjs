import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testSearch() {
  console.log('=== TESTING VITO SEARCH ===\n');

  // Get user ID (using first user)
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User ID:', userId);

  // Generate embedding for "tell me about vito in the godfather"
  const query = 'tell me about vito in the godfather';
  console.log('\nQuery:', query);

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log('Embedding generated, dimensions:', queryEmbedding.length);

  // Call vector search function
  console.log('\n=== CALLING match_documents ===');
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: userId,
  });

  if (vectorError) {
    console.error('Vector search error:', vectorError);
    return;
  }

  console.log('Vector results:', vectorResults?.length || 0);
  if (vectorResults && vectorResults.length > 0) {
    console.log('\nTop 5 vector results:');
    vectorResults.slice(0, 5).forEach((r, i) => {
      console.log(`\n[${i + 1}] Similarity: ${r.similarity}`);
      console.log(`Document: ${r.metadata?.file_name || 'unknown'}`);
      console.log(`Content preview: ${r.content.substring(0, 200)}`);
    });
  }

  // Call fulltext search function
  console.log('\n=== CALLING search_documents_fulltext ===');
  const { data: textResults, error: textError } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: userId,
  });

  if (textError) {
    console.error('Fulltext search error:', textError);
  } else {
    console.log('Fulltext results:', textResults?.length || 0);
    if (textResults && textResults.length > 0) {
      console.log('\nTop 5 fulltext results:');
      textResults.slice(0, 5).forEach((r, i) => {
        console.log(`\n[${i + 1}] Rank: ${r.rank}`);
        console.log(`Document: ${r.metadata?.file_name || 'unknown'}`);
        console.log(`Content preview: ${r.content.substring(0, 200)}`);
      });
    }
  }

  // Check a few actual chunks from Godfather
  console.log('\n=== SAMPLE CHUNKS FROM GODFATHER ===');
  const { data: sampleChunks } = await supabase
    .from('document_chunks')
    .select('id, content, chunk_index')
    .eq('document_id', '9df7d9c8-e2a2-4992-aac4-9e6319ec59f7')
    .order('chunk_index')
    .limit(10);

  if (sampleChunks) {
    sampleChunks.forEach(chunk => {
      console.log(`\n--- Chunk ${chunk.chunk_index} ---`);
      console.log(chunk.content.substring(0, 300));
    });
  }
}

testSearch().catch(console.error);
