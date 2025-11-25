/**
 * Test System Prompt Assembly (v2.0)
 * Validates: Executive assistant personality, unified approach, all sections
 */

import { readFileSync } from 'fs';

console.log('🧪 Testing System Prompt Assembly (v2.0)\n');
console.log('Validating: Executive assistant personality, mood adaptation, challenging rules\n');

let testsPassed = 0;
let testsFailed = 0;

// Read the orchestrator file
const orchestratorCode = readFileSync('./src/agents/master/orchestrator.ts', 'utf8');

// Test 1: Executive Assistant Personality
console.log('=== Test 1: Executive Assistant Personality ===\n');

const hasExecutiveAssistant = orchestratorCode.includes('long-time executive assistant');
const hasAccurateAnticipatory = orchestratorCode.includes('accurate, anticipatory, and direct');
const noHelpfulColleague = !orchestratorCode.includes('helpful colleague');

if (hasExecutiveAssistant && hasAccurateAnticipatory && noHelpfulColleague) {
  console.log('✅ PASS: Executive assistant personality implemented');
  console.log('  - "Long-time executive assistant" ✓');
  console.log('  - "Accurate, anticipatory, and direct" ✓');
  console.log('  - Removed "helpful colleague" ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Executive assistant personality missing');
  console.log(`  - Has exec assistant: ${hasExecutiveAssistant}`);
  console.log(`  - Has characteristics: ${hasAccurateAnticipatory}`);
  console.log(`  - Removed old: ${noHelpfulColleague}\n`);
  testsFailed++;
}

// Test 2: Mood-Adaptive Behavior
console.log('=== Test 2: Mood-Adaptive Behavior ===\n');

const hasBusyMode = orchestratorCode.includes('Busy → lead with the answer');
const hasCuriousMode = orchestratorCode.includes('Curious → provide context and depth');
const hasFrustratedMode = orchestratorCode.includes('Frustrated → simplify and solve');

if (hasBusyMode && hasCuriousMode && hasFrustratedMode) {
  console.log('✅ PASS: Mood-adaptive behavior included');
  console.log('  - Busy mode ✓');
  console.log('  - Curious mode ✓');
  console.log('  - Frustrated mode ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Mood-adaptive behavior incomplete\n');
  testsFailed++;
}

// Test 3: Anti-Reaffirmation Rules
console.log('=== Test 3: Anti-Reaffirmation Rules ===\n');

const hasChallenging = orchestratorCode.includes('Ask clarifying questions when requests are vague or ambiguous');
const hasNoRubberStamp = orchestratorCode.includes("don't rubber-stamp unclear ideas");
const hasExceptions = orchestratorCode.includes('Challenging Exceptions');
const hasEmotionalException = orchestratorCode.includes('Emotional processing or venting');

if (hasChallenging && hasNoRubberStamp && hasExceptions && hasEmotionalException) {
  console.log('✅ PASS: Anti-reaffirmation rules with exceptions');
  console.log('  - Challenges vague requests ✓');
  console.log('  - No rubber-stamping ✓');
  console.log('  - Has exception list ✓');
  console.log('  - Emotional exception ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Anti-reaffirmation incomplete\n');
  testsFailed++;
}

// Test 4: Unified RAG-Only Mode
console.log('=== Test 4: Unified RAG-Only Mode ===\n');

const hasStrictDataRules = orchestratorCode.includes('STRICT DATA RULES (RAG-ONLY MODE)');
const hasConversationalPhrase = orchestratorCode.includes('Not seeing that in the documents');
const hasInterpretationAllowed = orchestratorCode.includes('calculate totals, compare values');
const noVerboseExample = !orchestratorCode.includes('2024 Topps Chrome Card A');

if (hasStrictDataRules && hasConversationalPhrase && hasInterpretationAllowed) {
  console.log('✅ PASS: Unified RAG-only mode (strict + conversational)');
  console.log('  - Strict data rules ✓');
  console.log('  - Conversational language ✓');
  console.log('  - Interpretation allowed ✓');
  if (noVerboseExample) {
    console.log('  - Simplified examples ✓\n');
  } else {
    console.log('  - (Verbose example still present)\n');
  }
  testsPassed++;
} else {
  console.log('❌ FAIL: RAG-only mode incomplete\n');
  testsFailed++;
}

// Test 5: Memory Boundaries in Prompt
console.log('=== Test 5: Memory Boundaries in Approach ===\n');

const hasMemoryRelevance = orchestratorCode.includes('Only use memories when directly relevant');
const hasNoForcing = orchestratorCode.includes("don't force them into conversation");

if (hasMemoryRelevance && hasNoForcing) {
  console.log('✅ PASS: Memory boundary rules in prompt');
  console.log('  - Relevance requirement ✓');
  console.log('  - No forcing ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Memory boundaries missing\n');
  testsFailed++;
}

// Test 6: Reduced Verbosity
console.log('=== Test 6: Reduced Verbosity ===\n');

const hasLeadWithAnswer = orchestratorCode.includes('Lead with the answer, not process details');
const noPleasantries = !orchestratorCode.includes("I'd be happy to help");
const simplifiedGuidelines = orchestratorCode.includes('Data Accuracy:');

if (hasLeadWithAnswer && simplifiedGuidelines) {
  console.log('✅ PASS: Verbosity reduced');
  console.log('  - Lead with answer ✓');
  console.log('  - Simplified sections ✓');
  if (noPleasantries) {
    console.log('  - No generic pleasantries ✓\n');
  } else {
    console.log('  - (Some pleasantries may remain)\n');
  }
  testsPassed++;
} else {
  console.log('❌ FAIL: Verbosity reduction incomplete\n');
  testsFailed++;
}

// Test 7: Both Standard and RAG-Only Modes Exist
console.log('=== Test 7: Dual Mode Structure ===\n');

const hasConditional = orchestratorCode.includes('const strictMode = chatSettings?.ragOnlyMode');
const hasBothModes = orchestratorCode.includes('const systemPrompt = strictMode') && orchestratorCode.includes('? `You are a long-time');

if (hasConditional && hasBothModes) {
  console.log('✅ PASS: Both standard and RAG-only modes implemented');
  console.log('  - Conditional logic ✓');
  console.log('  - Both mode structures ✓\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Dual mode structure incomplete\n');
  testsFailed++;
}

// Summary
console.log('═══════════════════════════════════════');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('═══════════════════════════════════════\n');

if (testsFailed > 0) {
  console.log('⚠️  Some prompt assembly tests failed\n');
  process.exit(1);
} else {
  console.log('✅ All system prompt assembly tests passed!\n');
  console.log('Summary of v2.0 Prompt Features:');
  console.log('  ✓ Executive assistant personality');
  console.log('  ✓ Mood-adaptive behavior (busy/curious/frustrated)');
  console.log('  ✓ Anti-reaffirmation with exceptions');
  console.log('  ✓ Unified RAG-only mode (strict + conversational)');
  console.log('  ✓ Memory boundary rules');
  console.log('  ✓ Reduced verbosity');
  console.log('  ✓ Dual mode structure\n');
  process.exit(0);
}
