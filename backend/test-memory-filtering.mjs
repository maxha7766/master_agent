/**
 * Test Memory Retrieval Filtering (v2.0)
 * Validates: topK=3, minSimilarity=0.82, usage guidance in prompt
 */

import { formatMemoriesForPrompt } from './src/services/memory/memoryManager.js';

console.log('🧪 Testing Memory Retrieval Filtering (v2.0)\n');
console.log('Expected: Top 3 memories, 0.82 threshold, usage guidance\n');

let testsPassed = 0;
let testsFailed = 0;

// Mock memories with similarity scores
const mockMemories = [
  {
    id: '1',
    content: 'Works at Google as a software engineer',
    memory_type: 'fact',
    similarity: 0.95
  },
  {
    id: '2',
    content: 'Prefers TypeScript over JavaScript',
    memory_type: 'preference',
    similarity: 0.88
  },
  {
    id: '3',
    content: 'Has 3 years of experience with React',
    memory_type: 'fact',
    similarity: 0.85
  }
];

// Test 1: Memory formatting includes usage guidance
console.log('=== Test 1: Usage Guidance in Prompt ===\n');

const formattedPrompt = formatMemoriesForPrompt(mockMemories);

console.log('Formatted Prompt:');
console.log(formattedPrompt);

const hasUsageGuidance = formattedPrompt.includes('(Use these only when directly relevant');
const hasTitle = formattedPrompt.includes('What I remember about you:');

if (hasUsageGuidance && hasTitle) {
  console.log('\n✅ PASS: Usage guidance included in memory prompt\n');
  testsPassed++;
} else {
  console.log('\n❌ FAIL: Missing usage guidance');
  console.log(`  - Has guidance: ${hasUsageGuidance}`);
  console.log(`  - Has title: ${hasTitle}\n`);
  testsFailed++;
}

// Test 2: Memory grouping by type
console.log('=== Test 2: Memory Grouping by Type ===\n');

const hasFacts = formattedPrompt.includes('**Facts:**');
const hasPreferences = formattedPrompt.includes('**Preferences:**');
const hasCorrectFactContent = formattedPrompt.includes('Works at Google');
const hasCorrectPrefContent = formattedPrompt.includes('Prefers TypeScript');

if (hasFacts && hasPreferences && hasCorrectFactContent && hasCorrectPrefContent) {
  console.log('✅ PASS: Memories correctly grouped by type\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Memory grouping incorrect\n');
  testsFailed++;
}

// Test 3: Empty memories handling
console.log('=== Test 3: Empty Memories Handling ===\n');

const emptyPrompt = formatMemoriesForPrompt([]);

if (emptyPrompt === '') {
  console.log('✅ PASS: Empty memories return empty string\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Should return empty string for no memories\n');
  testsFailed++;
}

// Test 4: Verify orchestrator configuration
console.log('=== Test 4: Orchestrator Memory Config ===\n');

import { readFileSync } from 'fs';
const orchestratorCode = readFileSync('./src/agents/master/orchestrator.ts', 'utf8');

const hasTopK3 = orchestratorCode.includes('topK: 3');
const hasMinSim82 = orchestratorCode.includes('minSimilarity: 0.82');
const hasComment = orchestratorCode.includes('Reduced from 5 to prevent overuse');

if (hasTopK3 && hasMinSim82) {
  console.log('✅ PASS: Orchestrator uses topK=3, minSimilarity=0.82');
  if (hasComment) {
    console.log('  (Comment explaining reduction found)\n');
  } else {
    console.log('  (Comment not found but config is correct)\n');
  }
  testsPassed++;
} else {
  console.log('❌ FAIL: Orchestrator config incorrect');
  console.log(`  - topK=3: ${hasTopK3}`);
  console.log(`  - minSimilarity=0.82: ${hasMinSim82}\n`);
  testsFailed++;
}

// Summary
console.log('═══════════════════════════════════════');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('═══════════════════════════════════════\n');

if (testsFailed > 0) {
  console.log('⚠️  Some tests failed\n');
  process.exit(1);
} else {
  console.log('✅ All memory filtering tests passed!\n');
  console.log('Memory system now filters more strictly:');
  console.log('  - Top 3 memories (down from 5)');
  console.log('  - 0.82 similarity threshold (up from 0.7)');
  console.log('  - Usage guidance in prompt\n');
  process.exit(0);
}
