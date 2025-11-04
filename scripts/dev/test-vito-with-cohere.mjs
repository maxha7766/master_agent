import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function testWithCohere() {
  console.log('=== TESTING VITO QUERY WITH COHERE RERANKING ===\n');

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  const query = 'tell me about Vito in the Godfather';
  console.log('Query:', query);
  console.log('User ID:', userId);

  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Vector search
  const { data: vectorResults } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: userId,
  });

  // Fulltext search
  const { data: textResults } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: userId,
  });

  // RRF fusion
  const rrfK = 60;
  const scoreMap = new Map();

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

  const sorted = Array.from(scoreMap.values()).sort(
    (a, b) => b.combinedScore - a.combinedScore
  );

  const candidateResults = sorted.slice(0, 20);

  console.log('\n=== BEFORE COHERE RERANKING ===');
  console.log(`Top 5 RRF results:`);
  candidateResults.slice(0, 5).forEach((item, i) => {
    const r = item.result;
    console.log(`\n[${i + 1}] RRF: ${item.combinedScore.toFixed(6)}`);
    console.log(`Doc: ${r.metadata?.file_name}`);
    console.log(`Content: ${r.content.substring(0, 100)}...`);
  });

  // Apply Cohere reranking
  console.log('\n=== APPLYING COHERE RERANKING ===');

  const rerankDocs = candidateResults.map((item) => ({
    id: item.result.id,
    text: item.result.content,
  }));

  const rerankResponse = await cohere.rerank({
    query,
    documents: rerankDocs.map(d => d.text),
    topN: 5,
    model: 'rerank-english-v3.0',
  });

  console.log('\n=== AFTER COHERE RERANKING ===');
  console.log(`Reranked results: ${rerankResponse.results.length}`);

  rerankResponse.results.forEach((result, i) => {
    const originalDoc = candidateResults[result.index].result;
    console.log(`\n[${i + 1}] Cohere Score: ${result.relevanceScore.toFixed(6)}`);
    console.log(`Doc: ${originalDoc.metadata?.file_name}`);
    console.log(`Content: ${originalDoc.content.substring(0, 100)}...`);
  });

  // Check if Godfather results are in top 5
  const godfatherInTop5 = rerankResponse.results.some((result) => {
    const originalDoc = candidateResults[result.index].result;
    return originalDoc.metadata?.file_name?.includes('Godfather');
  });

  console.log(`\n=== RESULT ===`);
  console.log(`Godfather in top 5: ${godfatherInTop5}`);

  // Count Godfather results
  const godfatherCount = rerankResponse.results.filter((result) => {
    const originalDoc = candidateResults[result.index].result;
    return originalDoc.metadata?.file_name?.includes('Godfather');
  }).length;

  console.log(`Godfather results in top 5: ${godfatherCount}/5`);
}

testWithCohere().catch(console.error);
