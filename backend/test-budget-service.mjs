#!/usr/bin/env node
/**
 * Test Budget Service Fix
 * Verifies that checkBudget returns empty object instead of undefined
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDQyMTUsImV4cCI6MjA3NzE4MDIxNX0.blSSFEciIvXq7B6zrpob-CQKCRKFmF0qq6Tavk6KzsQ';
const WS_URL = 'wss://masteragent-production-9a9b.up.railway.app';
const TEST_EMAIL = 'heath.maxwell@gmail.com';

console.log('Testing Budget Service Fix via WebSocket...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign in
console.log(`Signing in as ${TEST_EMAIL}...`);
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: 'Temp1234!',
});

if (authError) {
  console.error('❌ Auth failed:', authError.message);
  process.exit(1);
}

console.log('✅ Signed in successfully');
const token = authData.session.access_token;

// Connect to WebSocket
console.log('\nConnecting to WebSocket...');
const WebSocket = (await import('ws')).default;
const ws = new WebSocket(WS_URL, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

ws.on('open', () => {
  console.log('✅ WebSocket connected');

  // Send a test message
  console.log('\nSending test message...');
  ws.send(JSON.stringify({
    type: 'chat_message',
    message: 'Hello, can you tell me about The Godfather?',
    conversationId: null,
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log(`\n📨 Received: ${message.type}`);

  if (message.type === 'error') {
    console.error('❌ Error:', message.message);
    if (message.message.includes('Cannot read properties of undefined')) {
      console.error('\n🔥 BUDGET SERVICE BUG STILL PRESENT!');
    }
    ws.close();
    process.exit(1);
  }

  if (message.type === 'chat_response_chunk') {
    process.stdout.write(message.content);
  }

  if (message.type === 'chat_response_end') {
    console.log('\n\n✅ SUCCESS! Message completed without budget error');
    ws.close();
    process.exit(0);
  }

  if (message.type === 'budget_warning') {
    console.log('⚠️  Budget warning:', message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nWebSocket closed');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\n❌ Timeout - no response received');
  ws.close();
  process.exit(1);
}, 30000);
