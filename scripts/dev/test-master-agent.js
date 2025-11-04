/**
 * Test Master Agent Flow
 * Traces the entire flow of a tabular query through the master agent
 */

import { handleUserQuery } from './src/agents/master/orchestrator.js';

const TEST_USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
const TEST_QUERY = 'how many customers did we sell to in Q4?';

console.log('🧪 Testing Master Agent Flow\n');
console.log('Query:', TEST_QUERY);
console.log('User ID:', TEST_USER_ID);
console.log('\n📊 Starting orchestration...\n');

async function runTest() {
  try {
    let fullResponse = '';

    // Call master agent orchestrator
    for await (const chunk of handleUserQuery(
      TEST_QUERY,
      TEST_USER_ID,
      [], // empty conversation history
      'claude-sonnet-4-20250514',
      0.7
    )) {
      if (chunk.content) {
        fullResponse += chunk.content;
        process.stdout.write(chunk.content);
      }

      if (chunk.done) {
        console.log('\n\n✅ Stream completed');
        break;
      }
    }

    console.log('\n\n📝 Full Response:');
    console.log(fullResponse);

    console.log('\n\n✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n\n❌ Test failed with error:');
    console.error(error);
    console.error('\n\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
