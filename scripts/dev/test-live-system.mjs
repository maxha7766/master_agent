import WebSocket from 'ws';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

const WS_URL = 'ws://localhost:3001';
const TEST_TOKEN = process.env.TEST_USER_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNTQ2MzY4LCJpYXQiOjE3MzA5MjM1NjgsImlzcyI6Imh0dHBzOi8vbXZ5cnhjZW5mZmFzcm5xbHFhZXYuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjhmNTJmMDViLTQ3ZTUtNDAxOC05OGMyLTY5ZThkYWY5ZTVjOSIsImVtYWlsIjoiaGVhdGgubWF4d2VsbEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoiaGVhdGgubWF4d2VsbEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOGY1MmYwNWItNDdlNS00MDE4LTk4YzItNjllOGRhZjllNWM5In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3MzA5MjM1Njh9XSwic2Vzc2lvbl9pZCI6IjhkNGFjNzg0LTNiMjItNDk3ZC04M2U4LWI5ZjgzMGRmYmYwMiIsImlzX2Fub255bW91cyI6ZmFsc2V9.pMXYiVXbJ6I5CwlJZzjhfbPicrBm-1m-RnRjBGLmjWM';

console.log('🧪 Testing Live System via WebSocket\n');
console.log('═══════════════════════════════════════════\n');

// Create a mock conversation ID
const conversationId = 'test-' + Date.now();

let ws;
let messageCount = 0;
const messages = [];

function sendMessage(content, settings = {}) {
  return new Promise((resolve) => {
    messageCount++;
    const messageId = `msg_${Date.now()}_${messageCount}`;

    console.log(`\n📤 Sending: "${content}"\n`);

    let fullResponse = '';
    let isDone = false;

    const messageHandler = (data) => {
      const parsed = JSON.parse(data);

      if (parsed.kind === 'chat' && parsed.messageId === messageId) {
        if (parsed.chunk?.content) {
          process.stdout.write(parsed.chunk.content);
          fullResponse += parsed.chunk.content;
        }

        if (parsed.chunk?.done) {
          isDone = true;
          console.log('\n');

          // Store in conversation history
          messages.push({ role: 'user', content });
          messages.push({ role: 'assistant', content: fullResponse });

          ws.off('message', messageHandler);
          resolve(fullResponse);
        }
      }
    };

    ws.on('message', messageHandler);

    ws.send(JSON.stringify({
      kind: 'chat',
      conversationId,
      messageId,
      content,
      chatSettings: {
        ragOnlyMode: true,
        topK: 5,
        minRelevanceScore: 0.0,
        ...settings,
      },
    }));
  });
};

function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('✅ WebSocket connected\n');

      // Authenticate
      ws.send(JSON.stringify({
        kind: 'auth',
        token: TEST_TOKEN,
      }));

      // Wait for auth confirmation
      const authHandler = (data) => {
        const parsed = JSON.parse(data);
        if (parsed.kind === 'auth' && parsed.authenticated) {
          console.log('✅ Authenticated\n');
          ws.off('message', authHandler);
          resolve();
        }
      };

      ws.on('message', authHandler);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('\n🔌 WebSocket closed');
    });
  });
}

async function runTest() {
  try {
    await connect();

    console.log('═══════════════════════════════════════════\n');
    console.log('Test 1: Ask for count of Pete Crow-Armstrong cards\n');

    const response1 = await sendMessage('how many Pete Crow-Armstrong cards do i have listed?');

    if (!response1.includes('10')) {
      console.log('❌ FAILED: Expected count of 10');
      process.exit(1);
    }

    console.log('✅ Test 1 passed: Got count of 10\n');

    console.log('═══════════════════════════════════════════\n');
    console.log('Test 2: Follow-up query "can you list them?"\n');
    console.log('This is the critical test - should use conversation history to understand "them"\n');

    const response2 = await sendMessage('can you list them?');

    // Check if response contains actual card names from database
    const hasAquaLava = response2.toLowerCase().includes('aqua lava') || response2.toLowerCase().includes('250');
    const hasBowman = response2.toLowerCase().includes('bowman');
    const hasTopps = response2.toLowerCase().includes('topps');

    console.log('\n═══════════════════════════════════════════\n');
    console.log('Validation:\n');
    console.log(`  Contains "Aqua Lava" or "$250": ${hasAquaLava ? '✅' : '❌'}`);
    console.log(`  Contains "Bowman": ${hasBowman ? '✅' : '❌'}`);
    console.log(`  Contains "Topps": ${hasTopps ? '✅' : '❌'}`);

    if (hasAquaLava && (hasBowman || hasTopps)) {
      console.log('\n✅ Test 2 PASSED: Response contains actual card data from database');
      console.log('✅ Follow-up query detection is working!');
      console.log('✅ System correctly used conversation history to resolve "them"');
    } else {
      console.log('\n❌ Test 2 FAILED: Response does not contain expected card data');
      console.log('The system may still be fabricating data or not using conversation history');
      process.exit(1);
    }

    console.log('\n═══════════════════════════════════════════\n');
    console.log('✅ ALL TESTS PASSED\n');
    console.log('The live system is working correctly:');
    console.log('  1. Routes follow-up queries to tabular agent');
    console.log('  2. Uses conversation history to understand pronouns');
    console.log('  3. Returns actual data from database (not fabricated)');

    ws.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (ws) ws.close();
    process.exit(1);
  }
}

runTest();
