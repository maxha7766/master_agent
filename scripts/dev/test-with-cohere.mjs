import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { CohereClientV2 } from 'cohere-ai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cohere = new CohereClientV2({ token: process.env.COHERE_API_KEY });

async function testWithCohere() {
  const testUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab';
  const query = 'tell me about vito in the godfather';

  console.log('=== FULL RAG PIPELINE WITH COHERE ===\n');
  console.log('Query:', query);
  console.log('User:', testUserId);

  // Step 1: Generate embedding
  console.log('\n[1/5] Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log('✓ Embedding generated');

  // Step 2: Vector search
  console.log('\n[2/5] Vector search (top 40)...');
  const { data: vectorResults } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: testUserId,
  });
  console.log(`✓ Vector results: ${vectorResults.length}`);

  // Step 3: Fulltext search
  console.log('\n[3/5] Fulltext search (top 40)...');
  const { data: textResults } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: testUserId,
  });
  console.log(`✓ Fulltext results: ${textResults.length}`);

  // Step 4: RRF Fusion
  console.log('\n[4/5] RRF Fusion (k=60)...');
  const k = 60;
  const scoreMap = new Map();

  vectorResults.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = 1.0 / (k + rank);
    scoreMap.set(result.id, {
      id: result.id,
      content: result.content,
      fileName: result.metadata?.file_name || 'unknown',
      vectorScore: rrfScore,
      textScore: 0,
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
        id: result.id,
        content: result.content,
        fileName: result.metadata?.file_name || 'unknown',
        vectorScore: 0,
        textScore: rrfScore,
        combinedScore: rrfScore,
      });
    }
  });

  const hybridResults = Array.from(scoreMap.values()).sort(
    (a, b) => b.combinedScore - a.combinedScore
  );

  console.log(`✓ Hybrid results: ${hybridResults.length}`);
  const topRRF = hybridResults.slice(0, 20);
  console.log(`  Taking top 20 for reranking`);

  // Step 5: Cohere Reranking
  console.log('\n[5/5] Cohere Reranking...');
  const rerankDocs = topRRF.map(r => r.content);

  const rerankedResponse = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query: query,
    documents: rerankDocs,
    topN: 5,
  });

  console.log(`✓ Reranked results: ${rerankedResponse.results.length}`);

  const finalResults = rerankedResponse.results.map(r => {
    const original = topRRF[r.index];
    return {
      ...original,
      cohereScore: r.relevanceScore,
    };
  });

  console.log('\n=== FINAL RESULTS ===\n');
  finalResults.forEach((r, i) => {
    console.log(`[${i + 1}] Cohere Score: ${r.cohereScore.toFixed(4)}`);
    console.log(`    File: ${r.fileName}`);
    console.log(`    RRF Score: ${r.combinedScore.toFixed(6)} (vector: ${r.vectorScore.toFixed(6)}, text: ${r.textScore.toFixed(6)})`);
    console.log(`    Content: ${r.content.substring(0, 150)}...`);
    console.log();
  });

  // Test filtering
  const minRelevanceScore = 0.2;
  const filtered = finalResults.filter(r => r.cohereScore >= minRelevanceScore);

  console.log('=== FILTERING ===');
  console.log(`minRelevanceScore: ${minRelevanceScore}`);
  console.log(`Results after filtering: ${filtered.length}`);

  if (filtered.length > 0) {
    console.log('\n✅ SUCCESS! Results found about Vito:');
    filtered.forEach((r, i) => {
      console.log(`\n[${i + 1}] ${r.fileName}`);
      console.log(`    ${r.content.substring(0, 200)}...`);
    });
  } else {
    console.log('\n⚠️  No results pass the threshold');
    console.log('Max Cohere score:', Math.max(...finalResults.map(r => r.cohereScore)));
  }
}

testWithCohere().catch(console.error);
