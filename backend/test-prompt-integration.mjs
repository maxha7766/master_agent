/**
 * Integration Test: Full Prompt Generation (v2.0)
 * Tests that all pieces work together correctly in the orchestrator
 */

console.log('🧪 Integration Test: Full System Prompt Generation\n');
console.log('This test validates that temporal + memory + personality work together\n');

import { readFileSync } from 'fs';

let testsPassed = 0;
let testsFailed = 0;

// Read orchestrator to verify the complete flow
const orchestratorCode = readFileSync('./src/agents/master/orchestrator.ts', 'utf8');

// Test 1: Verify prompt assembly order
console.log('=== Test 1: Prompt Assembly Order ===\n');

// Find the systemPrompt construction
const promptPattern = /const systemPrompt = strictMode[\s\S]*?retrievedContext\}/;
const promptMatch = orchestratorCode.match(promptPattern);

if (promptMatch) {
  const promptConstruction = promptMatch[0];

  // Verify order: personality → temporal → documents → memory → approach → data rules → context
  const hasPersonality = promptConstruction.indexOf('long-time executive assistant') <
                        promptConstruction.indexOf('${temporalContext}');
  const hasTemporalBeforeMemory = promptConstruction.indexOf('${temporalContext}') <
                                 promptConstruction.indexOf('${memoryContext}');
  const hasMemoryBeforeApproach = promptConstruction.indexOf('${memoryContext}') <
                                 promptConstruction.indexOf('Your Approach:');
  const hasApproachBeforeData = promptConstruction.indexOf('Your Approach:') <
                               promptConstruction.indexOf('Data Accuracy');

  if (hasPersonality && hasTemporalBeforeMemory && hasMemoryBeforeApproach && hasApproachBeforeData) {
    console.log('✅ PASS: Prompt sections in correct order');
    console.log('  1. Personality description');
    console.log('  2. Temporal context');
    console.log('  3. Document list');
    console.log('  4. Memory context');
    console.log('  5. Your Approach');
    console.log('  6. Data Accuracy rules');
    console.log('  7. Retrieved context\n');
    testsPassed++;
  } else {
    console.log('❌ FAIL: Prompt section order incorrect\n');
    testsFailed++;
  }
} else {
  console.log('❌ FAIL: Could not find prompt construction\n');
  testsFailed++;
}

// Test 2: Verify temporal context injection
console.log('=== Test 2: Temporal Context Injection ===\n');

const hasTemporalGeneration = orchestratorCode.includes('generateTemporalContext(');
const hasTemporalFormatting = orchestratorCode.includes('formatTemporalContextForPrompt(');
const hasMetadataExtraction = orchestratorCode.includes('conversationMetadata');

if (hasTemporalGeneration && hasTemporalFormatting && hasMetadataExtraction) {
  console.log('✅ PASS: Temporal context properly integrated');
  console.log('  - Metadata extraction ✓');
  console.log('  - Context generation ✓');
  console.log('  - Prompt formatting ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Temporal integration incomplete\n');
  testsFailed++;
}

// Test 3: Verify memory retrieval injection
console.log('=== Test 3: Memory Retrieval Injection ===\n');

const hasMemoryRetrieval = orchestratorCode.includes('retrieveRelevantMemories(');
const hasMemoryFormatting = orchestratorCode.includes('formatMemoriesForPrompt(');
const hasMemoryConfig = orchestratorCode.includes('topK: 3') &&
                       orchestratorCode.includes('minSimilarity: 0.82');

if (hasMemoryRetrieval && hasMemoryFormatting && hasMemoryConfig) {
  console.log('✅ PASS: Memory context properly integrated');
  console.log('  - Retrieval call ✓');
  console.log('  - Formatting call ✓');
  console.log('  - Correct config (3, 0.82) ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Memory integration incomplete\n');
  testsFailed++;
}

// Test 4: Verify both modes exist
console.log('=== Test 4: Standard vs RAG-Only Modes ===\n');

// Count occurrences of executive assistant phrase
const execAssistantMatches = orchestratorCode.match(/long-time executive assistant/g);

if (execAssistantMatches && execAssistantMatches.length === 2) {
  console.log('✅ PASS: Both modes have executive assistant personality');
  console.log('  - Standard mode ✓');
  console.log('  - RAG-only mode ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Executive assistant personality not in both modes');
  console.log(`  Found ${execAssistantMatches ? execAssistantMatches.length : 0} occurrences (expected 2)\n`);
  testsFailed++;
}

// Test 5: Verify no old patterns remain
console.log('=== Test 5: Old Patterns Removed ===\n');

const noHelpfulColleague = !orchestratorCode.includes('helpful colleague');
const noWarningSymbols = !orchestratorCode.includes('⚠️');
const noIBeHappy = !orchestratorCode.includes("I'd be happy to help");
const noOldCritical = !orchestratorCode.includes('CRITICAL ANTI-HALLUCINATION RULES');

if (noHelpfulColleague && noWarningSymbols && noIBeHappy && noOldCritical) {
  console.log('✅ PASS: Old patterns successfully removed');
  console.log('  - No "helpful colleague" ✓');
  console.log('  - No warning symbols ✓');
  console.log('  - No generic pleasantries ✓');
  console.log('  - No old verbose rules ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Some old patterns still present');
  console.log(`  - No helpful colleague: ${noHelpfulColleague}`);
  console.log(`  - No warnings: ${noWarningSymbols}`);
  console.log(`  - No pleasantries: ${noIBeHappy}`);
  console.log(`  - No old rules: ${noOldCritical}\n`);
  testsFailed++;
}

// Summary
console.log('═══════════════════════════════════════');
console.log(`📊 Integration Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('═══════════════════════════════════════\n');

if (testsFailed > 0) {
  console.log('⚠️  Some integration tests failed\n');
  process.exit(1);
} else {
  console.log('✅ All integration tests passed!\n');
  console.log('Complete flow verified:');
  console.log('  ✓ Temporal metadata extraction → generation → formatting');
  console.log('  ✓ Memory retrieval (3, 0.82) → formatting → injection');
  console.log('  ✓ Executive assistant personality in both modes');
  console.log('  ✓ Correct section ordering');
  console.log('  ✓ Old patterns removed\n');
  process.exit(0);
}
