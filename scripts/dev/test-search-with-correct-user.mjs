import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testSearch() {
  console.log('=== TESTING SEARCH WITH CORRECT USER ID ===\n');

  // Get the actual user ID from the Godfather document
  const { data: docs } = await supabase
    .from('documents')
    .select('user_id')
    .eq('file_name', 'The Godfather - PDF Room.pdf');

  const userId = docs[0].user_id;
  console.log('Correct User ID:', userId);

  // Generate embedding for query
  const query = 'tell me about vito in the godfather';
  console.log('Query:', query);

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log('Embedding generated\n');

  // Test vector search
  console.log('=== VECTOR SEARCH ===');
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 10,
    target_user_id: userId,
  });

  if (vectorError) {
    console.error('Vector search error:', vectorError);
  } else {
    console.log('Vector results:', vectorResults?.length || 0);
    if (vectorResults && vectorResults.length > 0) {
      console.log('\nTop 5 results:');
      vectorResults.slice(0, 5).forEach((r, i) => {
        console.log(`\n[${i + 1}] Similarity: ${r.similarity.toFixed(4)}`);
        console.log(`Content: ${r.content.substring(0, 200)}`);
      });
    }
  }

  // Test fulltext search
  console.log('\n=== FULLTEXT SEARCH ===');
  const { data: textResults, error: textError } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 10,
    target_user_id: userId,
  });

  if (textError) {
    console.error('Fulltext search error:', textError);
  } else {
    console.log('Fulltext results:', textResults?.length || 0);
    if (textResults && textResults.length > 0) {
      console.log('\nTop 5 results:');
      textResults.slice(0, 5).forEach((r, i) => {
        console.log(`\n[${i + 1}] Rank: ${r.rank}`);
        console.log(`Content: ${r.content.substring(0, 200)}`);
      });
    }
  }
}

testSearch().catch(console.error);
