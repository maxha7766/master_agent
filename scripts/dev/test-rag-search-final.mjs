import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testRAGSearch() {
  const testUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab';
  const query = 'tell me about vito in the godfather';

  console.log('=== TESTING RAG SEARCH ===');
  console.log('User ID:', testUserId);
  console.log('Query:', query);
  console.log();

  // Step 1: Generate embedding
  console.log('Step 1: Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log('✓ Embedding generated (dimensions:', queryEmbedding.length, ')');

  // Step 2: Vector search
  console.log('\nStep 2: Vector search...');
  const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: testUserId,
  });

  if (vectorError) {
    console.error('✗ Vector search error:', vectorError);
    return;
  }

  console.log('✓ Vector results:', vectorResults?.length || 0);
  if (vectorResults && vectorResults.length > 0) {
    console.log('\n  Top 3 vector results:');
    vectorResults.slice(0, 3).forEach((r, i) => {
      console.log(`\n  [${i + 1}] Similarity: ${r.similarity.toFixed(4)}`);
      const fileName = r.metadata?.file_name || 'unknown';
      console.log(`      File: ${fileName}`);
      console.log(`      Content: ${r.content.substring(0, 150)}...`);
    });
  }

  // Step 3: Fulltext search
  console.log('\nStep 3: Fulltext search...');
  const { data: textResults, error: textError } = await supabase.rpc('search_documents_fulltext', {
    search_query: query,
    match_threshold: 0.0,
    match_count: 40,
    target_user_id: testUserId,
  });

  if (textError) {
    console.error('✗ Fulltext search error:', textError);
  } else {
    console.log('✓ Fulltext results:', textResults?.length || 0);
    if (textResults && textResults.length > 0) {
      console.log('\n  Top 3 fulltext results:');
      textResults.slice(0, 3).forEach((r, i) => {
        console.log(`\n  [${i + 1}] Rank: ${r.rank}`);
        const fileName = r.metadata?.file_name || 'unknown';
        console.log(`      File: ${fileName}`);
        console.log(`      Content: ${r.content.substring(0, 150)}...`);
      });
    }
  }

  // Step 4: Simulate RRF fusion
  console.log('\nStep 4: RRF Fusion (k=60)...');
  const k = 60;
  const scoreMap = new Map();

  // Add vector scores
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

  // Add text scores
  textResults?.forEach((result, index) => {
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

  // Sort by combined score
  const hybridResults = Array.from(scoreMap.values()).sort(
    (a, b) => b.combinedScore - a.combinedScore
  );

  console.log('✓ Hybrid results:', hybridResults.length);
  console.log('\n  Top 5 after RRF:');
  hybridResults.slice(0, 5).forEach((r, i) => {
    console.log(`\n  [${i + 1}] Combined: ${r.combinedScore.toFixed(6)} (vector: ${r.vectorScore.toFixed(6)}, text: ${r.textScore.toFixed(6)})`);
    console.log(`      File: ${r.fileName}`);
    console.log(`      Content: ${r.content.substring(0, 150)}...`);
  });

  // Step 5: Filter by minRelevanceScore
  const minRelevanceScore = 0.2;
  const filteredResults = hybridResults.filter(r => r.combinedScore >= minRelevanceScore);

  console.log(`\nStep 5: Filtering by minRelevanceScore (${minRelevanceScore})...`);
  console.log('✓ Filtered results:', filteredResults.length);

  if (filteredResults.length === 0) {
    console.log('\n⚠️  NO RESULTS after filtering!');
    console.log('    Max RRF score:', Math.max(...hybridResults.map(r => r.combinedScore)));
    console.log('    Threshold:', minRelevanceScore);
  }

  console.log('\n=== SEARCH COMPLETE ===');
  console.log('Summary:');
  console.log('  Vector results:', vectorResults?.length || 0);
  console.log('  Fulltext results:', textResults?.length || 0);
  console.log('  Hybrid (RRF) results:', hybridResults.length);
  console.log('  After filtering (>= 0.2):', filteredResults.length);
}

testRAGSearch().catch(console.error);
