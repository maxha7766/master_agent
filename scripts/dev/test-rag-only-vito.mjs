import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simulate the search flow as it happens in the RAG agent
async function testRagOnlyFlow() {
  console.log('=== TESTING RAG-ONLY MODE VITO QUERY ===\n');

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User ID:', userId);

  const query = 'tell me about Vito in the Godfather';
  console.log('Query:', query);

  // Step 1: Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Step 2: Vector search
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 40, // rerankTopK * 2
    target_user_id: userId,
  });

  if (vectorError) {
    console.error('Vector search error:', vectorError);
    return;
  }

  console.log('\n=== VECTOR SEARCH RESULTS ===');
  console.log(`Total vector results: ${vectorResults?.length || 0}`);

  // Filter for Godfather only
  const godfatherVector = vectorResults?.filter(r =>
    r.metadata?.file_name?.includes('Godfather')
  ) || [];

  console.log(`Godfather vector results: ${godfatherVector.length}`);
  if (godfatherVector.length > 0) {
    console.log('\nTop 3 Godfather vector results:');
    godfatherVector.slice(0, 3).forEach((r, i) => {
      console.log(`\n[${i + 1}] Similarity: ${r.similarity}`);
      console.log(`Content: ${r.content.substring(0, 150)}...`);
    });
  }

  // Step 3: Fulltext search
  const { data: textResults, error: textError } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: userId,
  });

  console.log('\n=== FULLTEXT SEARCH RESULTS ===');
  console.log(`Total fulltext results: ${textResults?.length || 0}`);

  if (textResults && textResults.length > 0) {
    console.log('\nFulltext results:');
    textResults.forEach((r, i) => {
      console.log(`\n[${i + 1}] Rank: ${r.rank}`);
      console.log(`Document: ${r.metadata?.file_name}`);
      console.log(`Content: ${r.content.substring(0, 150)}...`);
    });
  }

  // Step 4: Simulate RRF fusion
  console.log('\n=== SIMULATING RRF FUSION ===');

  const rrfK = 60;
  const scoreMap = new Map();

  // Add vector scores
  vectorResults?.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = 1.0 / (rrfK + rank);

    scoreMap.set(result.id, {
      result,
      vectorScore: rrfScore,
      textScore: 0.0,
      combinedScore: rrfScore,
    });
  });

  // Add text scores
  textResults?.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = 1.0 / (rrfK + rank);

    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.textScore = rrfScore;
      existing.combinedScore += rrfScore;
    } else {
      scoreMap.set(result.id, {
        result,
        vectorScore: 0.0,
        textScore: rrfScore,
        combinedScore: rrfScore,
      });
    }
  });

  // Sort by combined score
  const sorted = Array.from(scoreMap.values()).sort(
    (a, b) => b.combinedScore - a.combinedScore
  );

  console.log(`Total fused results: ${sorted.length}`);
  console.log('\nTop 10 RRF results:');
  sorted.slice(0, 10).forEach((item, i) => {
    const r = item.result;
    console.log(`\n[${i + 1}] RRF Score: ${item.combinedScore.toFixed(6)} (vec: ${item.vectorScore.toFixed(6)}, text: ${item.textScore.toFixed(6)})`);
    console.log(`Document: ${r.metadata?.file_name || 'unknown'}`);
    console.log(`Content: ${r.content.substring(0, 100)}...`);
  });

  // Step 5: Check what would pass filtering
  console.log('\n=== FILTERING ANALYSIS ===');

  const minRelevanceScore = 0.0; // Default in RAG agent
  const candidateResults = sorted.slice(0, 20); // rerankTopK

  console.log(`Candidates for reranking: ${candidateResults.length}`);
  console.log(`Min relevance score: ${minRelevanceScore}`);
  console.log(`RRF scores range: ${candidateResults[0]?.combinedScore.toFixed(6)} - ${candidateResults[candidateResults.length - 1]?.combinedScore.toFixed(6)}`);

  // Filter by minRelevanceScore (with RRF scores)
  const filtered = candidateResults.filter(r => r.combinedScore >= minRelevanceScore);
  console.log(`Results passing filter: ${filtered.length}`);

  // Check how many are from Godfather
  const godfatherFiltered = filtered.filter(r =>
    r.result.metadata?.file_name?.includes('Godfather')
  );

  console.log(`Godfather results in top 20: ${godfatherFiltered.length}`);
}

testRagOnlyFlow().catch(console.error);
