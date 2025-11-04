/**
 * Test RAG via WebSocket directly (bypassing frontend)
 * This tests the backend chat handler with a RAG question
 */
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BACKEND_WS_URL = 'ws://localhost:3001/ws';
const TEST_USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== RAG WebSocket Test ===\n');

// Step 1: Create or get conversation
console.log('Step 1: Setting up conversation...');

const { data: existingConvs } = await supabase
  .from('conversations')
  .select('id')
  .eq('user_id', TEST_USER_ID)
  .limit(1);

let conversationId;

if (existingConvs && existingConvs.length > 0) {
  conversationId = existingConvs[0].id;
  console.log(`  Using existing conversation: ${conversationId}`);
} else {
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      user_id: TEST_USER_ID,
      title: 'RAG Test Conversation'
    })
    .select()
    .single();

  if (error) {
    console.error('  Error creating conversation:', error);
    process.exit(1);
  }

  conversationId = newConv.id;
  console.log(`  Created new conversation: ${conversationId}`);
}

// Step 2: Get auth token
console.log('\nStep 2: Getting auth token...');

const { data: session, error: authError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: 'test@example.com' // Replace with actual test user email
});

// For testing, we'll use the service role key to bypass auth
// In production, you'd get a real user session token

const authToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('  Using service role key for auth');

// Step 3: Connect to WebSocket
console.log('\nStep 3: Connecting to WebSocket...');

const ws = new WebSocket(BACKEND_WS_URL, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'X-User-ID': TEST_USER_ID
  }
});

let fullResponse = '';
let streamStarted = false;
let streamEnded = false;

ws.on('open', () => {
  console.log('  ✓ Connected to WebSocket\n');

  // Step 4: Send RAG question
  console.log('Step 4: Sending RAG question...');

  const message = {
    kind: 'chat',
    conversationId,
    content: 'What documents do you have access to? What are the key rules about baseball?'
  };

  ws.send(JSON.stringify(message));
  console.log(`  Sent: "${message.content}"`);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.kind === 'stream_start') {
    console.log('\nStep 5: Receiving response...');
    console.log(`  Stream started (agent: ${msg.agent}, model: ${msg.model})`);
    streamStarted = true;
  } else if (msg.kind === 'stream_chunk') {
    process.stdout.write(msg.chunk);
    fullResponse += msg.chunk;
  } else if (msg.kind === 'stream_end') {
    console.log('\n\n  Stream ended');
    console.log(`  Tokens: ${msg.metadata.tokensUsed.total}`);
    console.log(`  Cost: $${msg.metadata.costUsd.toFixed(6)}`);
    console.log(`  Latency: ${msg.metadata.latencyMs}ms`);
    streamEnded = true;

    // Step 6: Verify response
    console.log('\nStep 6: Verifying response...');

    const keywords = ['baseball', 'rules', 'document'];
    let matches = 0;

    for (const keyword of keywords) {
      if (fullResponse.toLowerCase().includes(keyword)) {
        console.log(`  ✓ Found keyword: "${keyword}"`);
        matches++;
      } else {
        console.log(`  ✗ Missing keyword: "${keyword}"`);
      }
    }

    if (matches >= 2) {
      console.log(`\n✓ TEST PASSED: RAG response contains relevant content (${matches}/${keywords.length} keywords)`);
      console.log(`  Response length: ${fullResponse.length} characters`);
    } else {
      console.log(`\n✗ TEST FAILED: Response may not use RAG (${matches}/${keywords.length} keywords)`);
    }

    ws.close();
  } else if (msg.kind === 'error') {
    console.error('\n✗ Error:', msg.error);
    console.error(`  Code: ${msg.code}`);
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('\n✗ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n=== Test Complete ===\n');

  if (!streamStarted) {
    console.error('✗ Stream never started - connection or authentication issue');
  } else if (!streamEnded) {
    console.error('✗ Stream started but did not complete normally');
  }

  process.exit(streamEnded ? 0 : 1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\n✗ Test timeout - closing connection');
  ws.close();
  process.exit(1);
}, 30000);
