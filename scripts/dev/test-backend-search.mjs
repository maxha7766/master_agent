import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const query = 'can i get the definition of a balk?';
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('=== Backend Search Simulation ===\n');
console.log(`Query: "${query}"`);
console.log(`User ID: ${userId}\n`);

// Generate embedding
console.log('🔢 Generating embedding...');
const embeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: query,
  dimensions: 1536,
});
const queryEmbedding = embeddingResponse.data[0].embedding;
console.log(`✅ Generated ${queryEmbedding.length} dimensions\n`);

// Call match_documents (vector search)
console.log('🔍 Calling match_documents...');
const { data: vectorData, error: vectorError } = await supabase.rpc('match_documents', {
  query_embedding: queryEmbedding,
  match_threshold: 0.0,
  match_count: 40,
  target_user_id: userId,
});

if (vectorError) {
  console.error('❌ Vector search error:', vectorError);
  process.exit(1);
}

console.log(`✅ Vector results: ${vectorData?.length || 0}`);
if (vectorData && vectorData.length > 0) {
  console.log(`   Top similarity: ${vectorData[0].similarity.toFixed(4)}`);
  console.log(`   Top content: ${vectorData[0].content.substring(0, 100)}...\n`);
}

// Simulate RRF
console.log('🔀 Simulating RRF fusion...');
const rrfK = 60;
const vectorResults = vectorData || [];
const textResults = [];

const scoreMap = new Map();

vectorResults.forEach((result, index) => {
  const rank = index + 1;
  const rrfScore = 1.0 / (rrfK + rank);
  scoreMap.set(result.id, {
    result,
    vectorScore: rrfScore,
    textScore: 0.0,
    combinedScore: rrfScore,
  });
});

textResults.forEach((result, index) => {
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

console.log(`✅ RRF complete: ${sorted.length} results`);
console.log(`   Top 3 RRF scores: ${sorted.slice(0, 3).map(s => s.combinedScore.toFixed(4)).join(', ')}\n`);

// Filter by minRelevanceScore = 0.0 and slice to rerankTopK = 20
const minRelevanceScore = 0.0;
const rerankTopK = 20;

let filteredResults = sorted
  .filter((r) => r.combinedScore >= minRelevanceScore)
  .slice(0, rerankTopK);

console.log(`🔍 After filtering (minRelevanceScore=${minRelevanceScore}, rerankTopK=${rerankTopK}):`);
console.log(`   Filtered count: ${filteredResults.length}\n`);

// Check enrichResults
const documentIds = [...new Set(filteredResults.map((r) => r.result.document_id))];
console.log(`📄 Fetching document metadata for ${documentIds.length} unique documents...`);

const { data: documents, error: docError } = await supabase
  .from('documents')
  .select('id, file_name')
  .in('id', documentIds);

if (docError) {
  console.error('❌ Document fetch error:', docError);
} else {
  console.log(`✅ Fetched ${documents?.length || 0} documents`);
  if (documents && documents.length > 0) {
    documents.forEach(d => console.log(`   - ${d.file_name} (${d.id})`));
  }
}

console.log('\n✅ Test complete!');
console.log(`\nFinal result count: ${filteredResults.length}`);
