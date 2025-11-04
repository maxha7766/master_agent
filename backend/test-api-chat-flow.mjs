#!/usr/bin/env node
/**
 * Test complete chat flow via API
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDQyMTUsImV4cCI6MjA3NzE4MDIxNX0.blSSFEciIvXq7B6zrpob-CQKCRKFmF0qq6Tavk6KzsQ';
const API_URL = 'https://masteragent-production-9a9b.up.railway.app';

console.log('='.repeat(60));
console.log('API CHAT FLOW TEST');
console.log('='.repeat(60));

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test with known user credentials
const TEST_EMAIL = 'heath.maxwell@gmail.com';
const TEST_PASSWORD = 'your_password_here'; // You'll need to provide this

console.log('\n⚠️  NOTE: This test requires valid login credentials');
console.log('   Update TEST_PASSWORD in the script to run the full test\n');

console.log('1. Testing login...');
console.log('   (Skipping - need real password)');

// For now, let's just test the API endpoints without auth
console.log('\n2. Testing GET /api/conversations without auth...');
const conversationsResponse = await fetch(`${API_URL}/api/conversations`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://master-agent-sage.vercel.app',
  },
});

console.log(`   Status: ${conversationsResponse.status} ${conversationsResponse.statusText}`);
if (!conversationsResponse.ok) {
  const error = await conversationsResponse.json().catch(() => ({}));
  console.log('   Expected - need auth token');
}

// Test POST /api/conversations without auth
console.log('\n3. Testing POST /api/conversations without auth...');
const createConvResponse = await fetch(`${API_URL}/api/conversations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'https://master-agent-sage.vercel.app',
  },
  body: JSON.stringify({ title: 'Test' }),
});

console.log(`   Status: ${createConvResponse.status} ${createConvResponse.statusText}`);
if (!conversationsResponse.ok) {
  console.log('   Expected - need auth token');
}

console.log('\n' + '='.repeat(60));
console.log('TESTING WITH AUTH TOKEN');
console.log('='.repeat(60));

// Get a session if user is logged in (for local testing)
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (!session) {
  console.log('\n❌ No active session found');
  console.log('   To test the full flow:');
  console.log('   1. Log in to the app at https://master-agent-sage.vercel.app');
  console.log('   2. Open browser console');
  console.log('   3. Run: localStorage.getItem(\'supabase.auth.token\')');
  console.log('   4. Copy the token and use it to test API calls');
  console.log('\n   OR check Railway logs to see what errors occur during real usage');
} else {
  console.log('\n✅ Found active session');
  const token = session.access_token;

  console.log('\n4. Testing GET /api/conversations WITH auth...');
  const authConvsResponse = await fetch(`${API_URL}/api/conversations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://master-agent-sage.vercel.app',
    },
  });

  console.log(`   Status: ${authConvsResponse.status}`);
  if (authConvsResponse.ok) {
    const convs = await authConvsResponse.json();
    console.log(`   ✅ Got ${convs.length} conversations`);
  } else {
    const error = await authConvsResponse.text();
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('\n5. Testing POST /api/conversations WITH auth...');
  const authCreateResponse = await fetch(`${API_URL}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://master-agent-sage.vercel.app',
    },
    body: JSON.stringify({ title: 'API Test Conversation' }),
  });

  console.log(`   Status: ${authCreateResponse.status}`);
  if (authCreateResponse.ok) {
    const newConv = await authCreateResponse.json();
    console.log(`   ✅ Created conversation: ${newConv.id}`);
    console.log(`   Title: ${newConv.title}`);
  } else {
    const error = await authCreateResponse.text();
    console.log(`   ❌ Error: ${error}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('NEXT STEPS');
console.log('='.repeat(60));
console.log('\nIf API calls work but chat doesn\'t:');
console.log('1. Check WebSocket connection in browser console');
console.log('2. Check Railway logs for backend errors');
console.log('3. Verify message handling in frontend');
console.log('4. Check if OPENAI_API_KEY and ANTHROPIC_API_KEY are set in Railway');
console.log('\n' + '='.repeat(60));
