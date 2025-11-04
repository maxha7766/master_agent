#!/usr/bin/env node

/**
 * Test Research API
 * Tests the research endpoint with a real query
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const BACKEND_URL = 'http://localhost:3001';
const TEST_EMAIL = 'heath.maxwell@gmail.com';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let authToken = '';

async function login() {
  console.log('\n🔐 Step 1: Getting auth token...');

  // Get user from Supabase
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === TEST_EMAIL);

  if (!user) {
    throw new Error(`User not found: ${TEST_EMAIL}`);
  }

  // Use service role key for testing
  authToken = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('✅ Auth token obtained');
  return { userId: user.id };
}

async function testResearch() {
  console.log('\n🔬 Step 2: Testing research API...');

  const response = await fetch(`${BACKEND_URL}/api/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      query: 'Latest developments in AI language models 2025',
      maxResults: 5,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Research API failed: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  console.log('✅ Research completed successfully!');
  console.log(`   Query: ${data.data.query}`);
  console.log(`   Domain: ${data.data.domain}`);
  console.log(`   Sources found: ${data.data.sources.length}`);
  console.log(`   Total results: ${data.data.totalResults}`);

  // Display top 3 sources
  console.log('\n📚 Top 3 sources:');
  data.data.sources.slice(0, 3).forEach((source, index) => {
    console.log(`\n${index + 1}. ${source.title}`);
    console.log(`   Source: ${source.source}`);
    console.log(`   Score: ${source.score.toFixed(2)}`);
    console.log(`   URL: ${source.url}`);
    console.log(`   Snippet: ${source.content.substring(0, 100)}...`);
  });

  return data.data;
}

async function runTests() {
  try {
    console.log('='.repeat(60));
    console.log('Research API Test');
    console.log('='.repeat(60));

    await login();
    const result = await testResearch();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

runTests();
