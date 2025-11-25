/**
 * Test Temporal Context Service
 * Validates time gap calculations and context generation
 */

import {
  calculateTimeGap,
  getTimeOfDay,
  getDayOfWeek,
  generateTemporalContext,
  formatTemporalContextForPrompt
} from './src/services/temporal/timeContext.ts';

console.log('🧪 Testing Temporal Context Service\n');

let testsPassed = 0;
let testsFailed = 0;

// Test 1: Time Gap Calculations
console.log('=== Test 1: Time Gap Calculations ===\n');

const now = new Date();

// Test immediate gap (2 minutes)
const immediate = new Date(now.getTime() - 2 * 60 * 1000);
const immediateGap = calculateTimeGap(immediate, now);
if (immediateGap.category === 'immediate' && immediateGap.minutes === 2 && !immediateGap.shouldAcknowledge) {
  console.log('✅ Immediate gap (2 min): PASS');
  console.log(`   Category: ${immediateGap.category}, Minutes: ${immediateGap.minutes}, Should Acknowledge: ${immediateGap.shouldAcknowledge}\n`);
  testsPassed++;
} else {
  console.log('❌ Immediate gap (2 min): FAIL');
  console.log(`   Expected: category=immediate, minutes=2, shouldAcknowledge=false`);
  console.log(`   Got: category=${immediateGap.category}, minutes=${immediateGap.minutes}, shouldAcknowledge=${immediateGap.shouldAcknowledge}\n`);
  testsFailed++;
}

// Test brief gap (15 minutes)
const brief = new Date(now.getTime() - 15 * 60 * 1000);
const briefGap = calculateTimeGap(brief, now);
if (briefGap.category === 'brief' && briefGap.minutes === 15 && !briefGap.shouldAcknowledge) {
  console.log('✅ Brief gap (15 min): PASS');
  console.log(`   Category: ${briefGap.category}, Minutes: ${briefGap.minutes}, Should Acknowledge: ${briefGap.shouldAcknowledge}\n`);
  testsPassed++;
} else {
  console.log('❌ Brief gap (15 min): FAIL');
  testsFailed++;
}

// Test moderate gap (45 minutes)
const moderate = new Date(now.getTime() - 45 * 60 * 1000);
const moderateGap = calculateTimeGap(moderate, now);
if (moderateGap.category === 'moderate' && moderateGap.minutes === 45 && moderateGap.shouldAcknowledge && moderateGap.contextLikelyShifted) {
  console.log('✅ Moderate gap (45 min): PASS');
  console.log(`   Category: ${moderateGap.category}, Minutes: ${moderateGap.minutes}, Context Shifted: ${moderateGap.contextLikelyShifted}\n`);
  testsPassed++;
} else {
  console.log('❌ Moderate gap (45 min): FAIL');
  console.log(`   Expected: category=moderate, shouldAcknowledge=true, contextLikelyShifted=true`);
  console.log(`   Got: category=${moderateGap.category}, shouldAcknowledge=${moderateGap.shouldAcknowledge}, contextLikelyShifted=${moderateGap.contextLikelyShifted}\n`);
  testsFailed++;
}

// Test long gap (3 hours)
const long = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const longGap = calculateTimeGap(long, now);
if (longGap.category === 'long' && longGap.hours === 3 && longGap.shouldAcknowledge) {
  console.log('✅ Long gap (3 hours): PASS');
  console.log(`   Category: ${longGap.category}, Hours: ${longGap.hours}, Should Acknowledge: ${longGap.shouldAcknowledge}\n`);
  testsPassed++;
} else {
  console.log('❌ Long gap (3 hours): FAIL');
  testsFailed++;
}

// Test very long gap (12 hours)
const veryLong = new Date(now.getTime() - 12 * 60 * 60 * 1000);
const veryLongGap = calculateTimeGap(veryLong, now);
if (veryLongGap.category === 'very_long' && veryLongGap.hours === 12 && veryLongGap.shouldAcknowledge) {
  console.log('✅ Very long gap (12 hours): PASS');
  console.log(`   Category: ${veryLongGap.category}, Hours: ${veryLongGap.hours}\n`);
  testsPassed++;
} else {
  console.log('❌ Very long gap (12 hours): FAIL');
  testsFailed++;
}

// Test new session gap (2 days)
const newSession = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const newSessionGap = calculateTimeGap(newSession, now);
if (newSessionGap.category === 'new_session' && newSessionGap.days === 2 && newSessionGap.shouldAcknowledge) {
  console.log('✅ New session gap (2 days): PASS');
  console.log(`   Category: ${newSessionGap.category}, Days: ${newSessionGap.days}\n`);
  testsPassed++;
} else {
  console.log('❌ New session gap (2 days): FAIL');
  testsFailed++;
}

// Test 2: Time of Day Detection
console.log('\n=== Test 2: Time of Day Detection ===\n');

const testTimes = [
  { hour: 5, expected: 'early_morning' },
  { hour: 9, expected: 'morning' },
  { hour: 14, expected: 'afternoon' },
  { hour: 18, expected: 'evening' },
  { hour: 22, expected: 'night' },
  { hour: 1, expected: 'late_night' }
];

for (const test of testTimes) {
  const testDate = new Date();
  testDate.setHours(test.hour, 0, 0, 0);
  const timeOfDay = getTimeOfDay(testDate);

  if (timeOfDay === test.expected) {
    console.log(`✅ Hour ${test.hour}:00 = ${timeOfDay}: PASS`);
    testsPassed++;
  } else {
    console.log(`❌ Hour ${test.hour}:00: FAIL (expected ${test.expected}, got ${timeOfDay})`);
    testsFailed++;
  }
}

// Test 3: Day of Week
console.log('\n=== Test 3: Day of Week Detection ===\n');

const dayName = getDayOfWeek(now);
const expectedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
if (expectedDays.includes(dayName)) {
  console.log(`✅ Day of week detected: ${dayName}: PASS\n`);
  testsPassed++;
} else {
  console.log(`❌ Day of week detection: FAIL (got ${dayName})\n`);
  testsFailed++;
}

// Test 4: Generate Temporal Context
console.log('=== Test 4: Generate Temporal Context ===\n');

const lastMessage = new Date(now.getTime() - 45 * 60 * 1000); // 45 minutes ago
const convStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

const context = generateTemporalContext(lastMessage, convStart);

console.log('Generated Context:');
console.log(`  - Current Time: ${context.currentTimeFormatted}`);
console.log(`  - Time of Day: ${context.timeOfDay}`);
console.log(`  - Session Context: ${context.sessionContext}`);
console.log(`  - Time Since Last Message: ${context.timeSinceLastMessage?.category} (${context.timeSinceLastMessage?.minutes} min)`);
console.log(`  - Conversation Duration: ${context.conversationDuration?.hours}h ${context.conversationDuration?.minutes % 60}m`);

if (context.timeSinceLastMessage?.category === 'moderate' &&
    context.conversationDuration?.hours === 2) {
  console.log('\n✅ Temporal context generation: PASS\n');
  testsPassed++;
} else {
  console.log('\n❌ Temporal context generation: FAIL\n');
  testsFailed++;
}

// Test 5: Format for Prompt
console.log('=== Test 5: Format Temporal Context for Prompt ===\n');

const formattedPrompt = formatTemporalContextForPrompt(context);
console.log('Formatted Prompt:\n');
console.log(formattedPrompt);

if (formattedPrompt.includes('Current Time:') &&
    formattedPrompt.includes('MODERATE TIME GAP') &&
    formattedPrompt.includes('Conversation Duration:')) {
  console.log('\n✅ Prompt formatting: PASS\n');
  testsPassed++;
} else {
  console.log('\n❌ Prompt formatting: FAIL\n');
  testsFailed++;
}

// Test 6: Edge Cases
console.log('=== Test 6: Edge Cases ===\n');

// No last message time
const contextNoLast = generateTemporalContext(undefined, convStart);
if (!contextNoLast.timeSinceLastMessage && contextNoLast.conversationDuration) {
  console.log('✅ No last message time: PASS');
  testsPassed++;
} else {
  console.log('❌ No last message time: FAIL');
  testsFailed++;
}

// No conversation start
const contextNoStart = generateTemporalContext(lastMessage, undefined);
if (contextNoStart.timeSinceLastMessage && !contextNoStart.conversationDuration) {
  console.log('✅ No conversation start: PASS');
  testsPassed++;
} else {
  console.log('❌ No conversation start: FAIL');
  testsFailed++;
}

// No timestamps at all
const contextNoTimes = generateTemporalContext(undefined, undefined);
if (!contextNoTimes.timeSinceLastMessage && !contextNoTimes.conversationDuration && contextNoTimes.currentTime) {
  console.log('✅ No timestamps provided: PASS\n');
  testsPassed++;
} else {
  console.log('❌ No timestamps provided: FAIL\n');
  testsFailed++;
}

// Summary
console.log('\n═══════════════════════════════════════');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('═══════════════════════════════════════\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('✅ All temporal context tests passed!\n');
  process.exit(0);
}
