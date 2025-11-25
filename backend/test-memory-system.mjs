/**
 * Test Memory System End-to-End
 * Tests the complete memory extraction, storage, and retrieval pipeline
 */

import { createClient } from '@supabase/supabase-js';
import { processMessage } from './src/services/memory/memoryExtractor.ts';
import { retrieveRelevantMemories, formatMemoriesForPrompt } from './src/services/memory/memoryManager.ts';
import { getAllEntities, getEntityWithRelations } from './src/services/memory/entityManager.ts';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

// Test user ID (replace with actual user ID from your database)
const TEST_USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

async function main() {
  console.log('🧪 Testing Memory System End-to-End\n');

  // Test 1: Extract memories from a sample message
  console.log('📝 Test 1: Extracting memories from message...');
  const testMessage = "I love playing tennis on weekends. I work at Google as a software engineer in San Francisco. My favorite programming language is TypeScript.";

  // Use proper UUIDs
  const { randomUUID } = await import('crypto');
  const messageId = randomUUID();
  const conversationId = randomUUID();

  // For testing, use null for conversation_id to avoid foreign key constraint
  const result = await processMessage(
    messageId,
    null, // null conversation ID to avoid FK constraint in test
    TEST_USER_ID,
    testMessage,
    'User: Hi, tell me about yourself\nAssistant: Sure, I\'d be happy to learn about you!'
  );

  console.log(`✅ Extracted:`);
  console.log(`   - ${result.memoriesCreated} memories`);
  console.log(`   - ${result.entitiesCreated} entities`);
  console.log(`   - ${result.relationshipsCreated} relationships\n`);

  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Retrieve relevant memories
  console.log('🔍 Test 2: Retrieving memories about "work"...');
  const memories = await retrieveRelevantMemories('work', TEST_USER_ID, {
    topK: 5,
    minSimilarity: 0.5,
  });

  console.log(`✅ Found ${memories.length} relevant memories:`);
  memories.forEach((mem, i) => {
    console.log(`   ${i + 1}. [${mem.memory_type}] ${mem.content.substring(0, 80)}... (similarity: ${mem.similarity.toFixed(2)})`);
  });
  console.log();

  // Test 3: Format memories for prompt
  console.log('📄 Test 3: Formatting memories for prompt...');
  const formatted = formatMemoriesForPrompt(memories);
  console.log(formatted);

  // Test 4: Retrieve entities
  console.log('👥 Test 4: Retrieving all entities...');
  const entities = await getAllEntities(TEST_USER_ID);

  console.log(`✅ Found ${entities.length} entities:`);
  entities.slice(0, 10).forEach((entity, i) => {
    console.log(`   ${i + 1}. [${entity.entity_type}] ${entity.name} (mentions: ${entity.mention_count})`);
  });
  console.log();

  // Test 5: Get entity with relationships
  if (entities.length > 0) {
    console.log('🔗 Test 5: Getting entity with relationships...');
    const entityWithRelations = await getEntityWithRelations(entities[0].id);

    if (entityWithRelations) {
      console.log(`✅ Entity: ${entityWithRelations.entity.name}`);
      console.log(`   Type: ${entityWithRelations.entity.entity_type}`);
      console.log(`   Relationships: ${entityWithRelations.relationships.length}`);
      console.log(`   Related Entities: ${entityWithRelations.relatedEntities.length}`);

      if (entityWithRelations.relationships.length > 0) {
        console.log(`   Sample relationship: ${entityWithRelations.relationships[0].relationship_type}`);
      }
    }
    console.log();
  }

  // Test 6: Memory statistics
  console.log('📊 Test 6: Memory statistics...');
  const { data: memoryStats } = await supabase
    .from('user_memories')
    .select('memory_type')
    .eq('user_id', TEST_USER_ID);

  const stats = {};
  memoryStats?.forEach(m => {
    stats[m.memory_type] = (stats[m.memory_type] || 0) + 1;
  });

  console.log('Memory type distribution:');
  Object.entries(stats).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
  });
  console.log();

  console.log('✅ All tests completed!\n');
  console.log('Summary:');
  console.log(`   - Total memories in database: ${memoryStats?.length || 0}`);
  console.log(`   - Total entities: ${entities.length}`);
  console.log(`   - Memory extraction: ${result.memoriesCreated > 0 ? '✅ Working' : '❌ Failed'}`);
  console.log(`   - Memory retrieval: ${memories.length > 0 ? '✅ Working' : '⚠️  No results'}`);
  console.log(`   - Entity extraction: ${result.entitiesCreated > 0 ? '✅ Working' : '❌ Failed'}`);

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
