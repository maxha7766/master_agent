/**
 * Test Updated Temporal Context (v2.0)
 * Validates refined temporal awareness with natural language
 */

import {
  generateTemporalContext,
  formatTemporalContextForPrompt
} from './src/services/temporal/timeContext.ts';

console.log('🧪 Testing Updated Temporal Context (v2.0)\n');
console.log('Testing refinements: No warnings, only gaps ≥30min, natural language\n');

let testsPassed = 0;
let testsFailed = 0;

const now = new Date();

// Test 1: Brief gap (15 minutes) - Should NOT appear
console.log('=== Test 1: Brief Gap (15 min) - Should NOT Appear ===\n');

const brief = new Date(now.getTime() - 15 * 60 * 1000);
const briefContext = generateTemporalContext(brief, undefined);
const briefPrompt = formatTemporalContextForPrompt(briefContext);

console.log('Generated Prompt:');
console.log(briefPrompt);

if (!briefPrompt.includes('Time since last message')) {
  console.log('✅ PASS: Brief gap not mentioned (as expected)\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Brief gap should not be mentioned\n');
  testsFailed++;
}

// Test 2: Moderate gap (45 minutes) - Should appear naturally
console.log('=== Test 2: Moderate Gap (45 min) - Natural Language ===\n');

const moderate = new Date(now.getTime() - 45 * 60 * 1000);
const convStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const moderateContext = generateTemporalContext(moderate, convStart);
const moderatePrompt = formatTemporalContextForPrompt(moderateContext);

console.log('Generated Prompt:');
console.log(moderatePrompt);

const hasTimeGap = moderatePrompt.includes('Time since last message: 45 minutes');
const hasNaturalNote = moderatePrompt.includes('Note: User may have shifted context');
const noWarningSymbol = !moderatePrompt.includes('⚠️');
const noAllCaps = !moderatePrompt.includes('MODERATE TIME GAP');

if (hasTimeGap && hasNaturalNote && noWarningSymbol && noAllCaps) {
  console.log('✅ PASS: Moderate gap shown naturally without warnings\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Expected natural language format');
  console.log(`  - Has time gap: ${hasTimeGap}`);
  console.log(`  - Has natural note: ${hasNaturalNote}`);
  console.log(`  - No warning symbol: ${noWarningSymbol}`);
  console.log(`  - No all-caps: ${noAllCaps}\n`);
  testsFailed++;
}

// Test 3: Long gap (3 hours) - Natural acknowledgment
console.log('=== Test 3: Long Gap (3 hours) - Natural Language ===\n');

const long = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const longContext = generateTemporalContext(long, convStart);
const longPrompt = formatTemporalContextForPrompt(longContext);

console.log('Generated Prompt:');
console.log(longPrompt);

const hasLongGap = longPrompt.includes('Time since last message: 3 hours');
const hasNaturalLongNote = longPrompt.includes('Significant time has passed');
const noWarningInLong = !longPrompt.includes('⚠️');

if (hasLongGap && hasNaturalLongNote && noWarningInLong) {
  console.log('✅ PASS: Long gap shown naturally\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Long gap format incorrect\n');
  testsFailed++;
}

// Test 4: New session (2 days) - Natural welcome
console.log('=== Test 4: New Session (2 days) - Natural Language ===\n');

const newSession = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const sessionContext = generateTemporalContext(newSession, convStart);
const sessionPrompt = formatTemporalContextForPrompt(sessionContext);

console.log('Generated Prompt:');
console.log(sessionPrompt);

const hasSessionGap = sessionPrompt.includes('Time since last message: 2 day(s)');
const hasNaturalSession = sessionPrompt.includes('New session. Acknowledge time gap naturally');
const noWarningInSession = !sessionPrompt.includes('⚠️');

if (hasSessionGap && hasNaturalSession && noWarningInSession) {
  console.log('✅ PASS: New session shown naturally\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: New session format incorrect\n');
  testsFailed++;
}

// Test 5: Verify conversation duration still appears
console.log('=== Test 5: Conversation Duration ===\n');

if (moderatePrompt.includes('Conversation Duration: 2h 0m')) {
  console.log('✅ PASS: Conversation duration still shown\n');
  testsPassed++;
} else {
  console.log('❌ FAIL: Conversation duration missing\n');
  testsFailed++;
}

// Summary
console.log('═══════════════════════════════════════');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('═══════════════════════════════════════\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('✅ All temporal context v2.0 tests passed!\n');
  process.exit(0);
}
