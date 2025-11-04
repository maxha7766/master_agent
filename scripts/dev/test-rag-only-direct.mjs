/**
 * Test RAG-only mode by simulating the actual chat flow
 * This bypasses TypeScript compilation and directly tests the search
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

/**
 * Simulate the exact search flow from vectorSearchService
 */
async function simulateSearch(query, userId, options = {}) {
  const {
    topK = 5,
    vectorThreshold = 0.0,
    textThreshold = 0.0,
    minRelevanceScore = 0.0,
    rrfK = 60,
    useReranking = true,
    rerankTopK = 20,
  } = options;

  console.log('Search parameters:', {
    topK,
    minRelevanceScore,
    useReranking,
    rerankTopK,
  });

  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Vector search
  const { data: vectorResults, error: vectorError } = await supabase.rpc(
    'match_documents',
    {
      query_embedding: queryEmbedding,
      match_threshold: vectorThreshold,
      match_count: rerankTopK * 2,
      target_user_id: userId,
    }
  );

  if (vectorError) throw vectorError;

  console.log(`Vector results: ${vectorResults?.length || 0}`);

  // Fulltext search
  const { data: textResults, error: textError } = await supabase.rpc(
    'search_documents_fulltext',
    {
      search_query: query,
      match_threshold: textThreshold,
      match_count: rerankTopK * 2,
      target_user_id: userId,
    }
  );

  if (textError) {
    console.warn('Fulltext search failed:', textError.message);
  }

  console.log(`Fulltext results: ${textResults?.length || 0}`);

  // RRF fusion
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

  console.log(`Fused results: ${sorted.length}`);

  let candidateResults = sorted.slice(0, rerankTopK);
  console.log(`Candidates for reranking: ${candidateResults.length}`);

  let filteredResults;

  // Apply Cohere reranking if enabled
  if (useReranking && process.env.COHERE_API_KEY && candidateResults.length > 0) {
    console.log('Applying Cohere reranking...');

    const rerankDocs = candidateResults.map((item) => ({
      id: item.result.id,
      text: item.result.content,
    }));

    const rerankResponse = await cohere.rerank({
      query,
      documents: rerankDocs.map((d) => d.text),
      topN: topK,
      model: 'rerank-english-v3.0',
    });

    console.log(`Reranked to ${rerankResponse.results.length} results`);

    // Map back to results with Cohere scores
    const resultsWithCohereScores = rerankResponse.results.map((rr) => {
      const original = candidateResults[rr.index].result;
      return {
        chunkId: original.id,
        documentId: original.document_id,
        content: original.content,
        metadata: original.metadata || {},
        similarityScore: original.similarity || 0,
        relevanceScore: rr.relevanceScore, // Cohere score 0-1
        fileName: original.metadata?.file_name,
        chunkIndex: original.chunk_index,
        pageNumber: original.page_number,
      };
    });

    console.log('Top Cohere scores:', resultsWithCohereScores.slice(0, 3).map(r => r.relevanceScore));

    // Filter by minRelevanceScore
    filteredResults = resultsWithCohereScores.filter(
      (r) => r.relevanceScore >= minRelevanceScore
    );

    console.log(`After filtering (minScore=${minRelevanceScore}): ${filteredResults.length}`);
  } else {
    console.log('No reranking - using RRF scores');
    const rrfMinScore = Math.min(0.01, minRelevanceScore);

    filteredResults = candidateResults
      .filter((item) => item.combinedScore >= rrfMinScore)
      .slice(0, topK)
      .map((item) => ({
        chunkId: item.result.id,
        documentId: item.result.document_id,
        content: item.result.content,
        metadata: item.result.metadata || {},
        similarityScore: item.result.similarity || 0,
        relevanceScore: item.combinedScore,
        fileName: item.result.metadata?.file_name,
        chunkIndex: item.result.chunk_index,
        pageNumber: item.result.page_number,
      }));

    console.log(`After filtering (minScore=${rrfMinScore}): ${filteredResults.length}`);
  }

  return filteredResults;
}

async function testRagOnlyMode() {
  console.log('=== TESTING RAG-ONLY MODE ===\n');

  // Get user
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User ID:', userId);

  const query = 'tell me about Vito in the Godfather';
  console.log(`Query: "${query}"\n`);

  // Test with RAG-only mode settings
  const chatSettings = {
    ragOnlyMode: true,
    topK: 5,
    minRelevanceScore: 0.0, // Default from RAG agent
  };

  console.log('Chat Settings:', chatSettings);
  console.log('\n=== RUNNING SEARCH ===\n');

  try {
    const results = await simulateSearch(query, userId, chatSettings);

    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total results: ${results.length}`);

    if (results.length > 0) {
      console.log('\nResults:');
      results.forEach((r, i) => {
        console.log(`\n[${i + 1}] Score: ${r.relevanceScore.toFixed(6)}`);
        console.log(`Document: ${r.fileName}`);
        console.log(`Content: ${r.content.substring(0, 120)}...`);
      });

      // Check orchestrator logic
      const hasRetrievedData = results && results.length > 0;

      console.log('\n=== RAG-ONLY MODE CHECK ===');
      console.log(`hasRetrievedData: ${hasRetrievedData}`);

      if (chatSettings.ragOnlyMode && !hasRetrievedData) {
        console.log('❌ FAIL: Would return "no relevant information" message');
      } else {
        console.log('✅ PASS: Would synthesize response from retrieved data');
      }
    } else {
      console.log('\n❌ NO RESULTS!');
      console.log('This is the problem - search returns 0 results');
      console.log('Orchestrator would return "no relevant information" message');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testRagOnlyMode().catch(console.error);
