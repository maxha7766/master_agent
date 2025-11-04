import 'dotenv/config';
import { ragAgent } from './dist/agents/rag/index.js';

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
const query = 'can i get the definition of a balk?';

console.log('=== Testing RAG Agent Directly ===\n');
console.log(`Query: "${query}"`);
console.log(`User ID: ${userId}\n`);

try {
  console.log('🔍 Calling ragAgent.generateResponse()...\n');

  const response = await ragAgent.generateResponse(query, userId, {
    topK: 5,
    minRelevanceScore: 0.0,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    includeSources: true,
  });

  console.log('✅ Response received!\n');
  console.log('📄 Content:');
  console.log(response.content);
  console.log('\n📚 Sources:');
  response.sources.forEach((source, i) => {
    console.log(`\n[${i + 1}] ${source.fileName} (chunk ${source.chunkIndex}, page ${source.pageNumber})`);
    console.log(`    Relevance: ${source.relevanceScore.toFixed(4)}`);
    console.log(`    Excerpt: ${source.excerpt}`);
  });

  console.log('\n📊 Metadata:');
  console.log(JSON.stringify(response.metadata, null, 2));

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
