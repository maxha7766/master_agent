/**
 * Test the orchestrator fix for RAG-only mode
 * Simulates the exact flow with the fix applied
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

async function simulateOrchestrator() {
  console.log('=== TESTING RAG-ONLY MODE WITH FIX ===\n');

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

  // Step 1: Query documents
  console.log('=== STEP 1: Query Documents ===');
  const { data: documents } = await supabase
    .from('documents')
    .select('id, file_name, file_type, row_count, column_count, chunk_count')
    .eq('user_id', userId)
    .eq('status', 'completed');

  console.log(`Documents: ${documents.length}`);

  const hasTextDocs = documents.some((d) => !d.row_count && d.chunk_count);
  console.log(`Has text docs: ${hasTextDocs}`);

  // Step 2: Simulate decideSubAgents
  console.log('\n=== STEP 2: Decide Sub-Agents ===');

  // Simulate LLM deciding NOT to use RAG (the bug scenario)
  let decision = {
    useRAG: false, // INCORRECTLY decides not to use RAG
    useTabular: false,
    reasoning: 'Query seems too general',
  };

  console.log('Initial decision:', decision);

  // Apply the FIX: Override if RAG-only mode is enabled
  const chatSettings = {
    ragOnlyMode: true,
    topK: 5,
    minRelevanceScore: 0.0,
  };

  console.log('\nChat settings:', chatSettings);

  if (chatSettings.ragOnlyMode) {
    console.log('\n🔧 APPLYING FIX: RAG-only mode detected');

    if (hasTextDocs && !decision.useRAG) {
      console.log('✅ Forcing useRAG=true (was false)');
      decision.useRAG = true;
      decision.reasoning += ' (Forced by RAG-only mode)';
    }

    if (decision.useTabular) {
      console.log('🚫 Blocking tabular query');
      decision.useTabular = false;
      decision.reasoning += ' (Tabular blocked by RAG-only mode)';
    }
  }

  console.log('\nFinal decision:', decision);

  // Step 3: Retrieve RAG context
  if (decision.useRAG) {
    console.log('\n=== STEP 3: Retrieve RAG Context ===');

    // Simulate search
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
        combinedScore: rrfScore,
      });
    });

    textResults?.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1.0 / (rrfK + rank);
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.combinedScore += rrfScore;
      } else {
        scoreMap.set(result.id, {
          result,
          combinedScore: rrfScore,
        });
      }
    });

    const sorted = Array.from(scoreMap.values()).sort(
      (a, b) => b.combinedScore - a.combinedScore
    );

    const candidateResults = sorted.slice(0, 20);

    // Apply Cohere reranking
    const rerankDocs = candidateResults.map((item) => ({
      id: item.result.id,
      text: item.result.content,
    }));

    const rerankResponse = await cohere.rerank({
      query,
      documents: rerankDocs.map((d) => d.text),
      topN: 5,
      model: 'rerank-english-v3.0',
    });

    const ragContext = rerankResponse.results.map((rr) => {
      const original = candidateResults[rr.index].result;
      return {
        chunkId: original.id,
        documentId: original.document_id,
        content: original.content,
        relevanceScore: rr.relevanceScore,
        fileName: original.metadata?.file_name,
      };
    });

    console.log(`RAG context retrieved: ${ragContext.length} chunks`);

    // Step 4: Check RAG-only mode logic
    console.log('\n=== STEP 4: RAG-Only Mode Check ===');
    const hasRetrievedData = ragContext && ragContext.length > 0;

    console.log(`hasRetrievedData: ${hasRetrievedData}`);

    if (chatSettings.ragOnlyMode && !hasRetrievedData) {
      console.log('❌ WOULD FAIL: No data retrieved');
    } else {
      console.log('✅ WOULD SUCCEED: Has data to synthesize');
      console.log('\nTop 3 results:');
      ragContext.slice(0, 3).forEach((chunk, i) => {
        console.log(`\n[${i + 1}] Score: ${chunk.relevanceScore.toFixed(6)}`);
        console.log(`Document: ${chunk.fileName}`);
        console.log(`Content: ${chunk.content.substring(0, 100)}...`);
      });
    }
  } else {
    console.log('\n❌ BUG: useRAG is still false after fix!');
  }
}

simulateOrchestrator().catch(console.error);
