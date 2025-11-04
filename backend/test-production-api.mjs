#!/usr/bin/env node
/**
 * Test Production API with real auth
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDQyMTUsImV4cCI6MjA3NzE4MDIxNX0.blSSFEciIvXq7B6zrpob-CQKCRKFmF0qq6Tavk6KzsQ';
const API_URL = 'https://masteragent-production-9a9b.up.railway.app';
const TEST_EMAIL = 'heath.maxwell@gmail.com';

console.log('Testing Production API...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Try to get existing session (won't work in CLI, but shows the flow)
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  console.log('❌ No active session - need to log in');
  console.log('\nTo test with auth:');
  console.log('1. Log in at https://master-agent-sage.vercel.app');
  console.log('2. Open browser console (F12)');
  console.log('3. Run: localStorage.getItem("sb-omjwoyyhpdawjxsbpamc-auth-token")');
  console.log('4. Copy the token and test API manually\n');

  console.log('Testing without auth (should fail):');
  const response = await fetch(`${API_URL}/api/documents`, {
    headers: {
      'Origin': 'https://master-agent-sage.vercel.app',
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  const data = await response.json();
  console.log('Response:', data);

  if (response.status === 401) {
    console.log('\n✅ Good - API correctly requires authentication');
  }
} else {
  console.log('✅ Found session:', session.user.email);

  // Test API with auth
  console.log('\nTesting /api/documents with auth...');
  const response = await fetch(`${API_URL}/api/documents`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Origin': 'https://master-agent-sage.vercel.app',
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const docs = await response.json();
    console.log(`✅ Got ${docs.length} documents`);
    if (docs.length > 0) {
      console.log('Sample:', docs.slice(0, 3).map(d => d.title || d.file_name));
    }
  } else {
    const error = await response.text();
    console.log('❌ Error:', error);
  }
}
