#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('Testing search functions...\n');

// Test 1: match_documents (vector search)
console.log('1. Testing match_documents (vector search)...');
const dummyEmbedding = new Array(1536).fill(0.001); // Dummy embedding

const { data: matchDocs, error: matchError } = await supabase.rpc('match_documents', {
  query_embedding: dummyEmbedding,
  match_threshold: 0.0,
  match_count: 3,
  target_user_id: USER_ID,
});

if (matchError) {
  console.log('❌ match_documents error:', matchError.message);
} else {
  console.log(`✅ match_documents works! Found ${matchDocs.length} results`);
  if (matchDocs.length > 0) {
    console.log('   Sample result keys:', Object.keys(matchDocs[0]));
  }
}

// Test 2: search_documents_fulltext
console.log('\n2. Testing search_documents_fulltext...');
const { data: fulltext, error: fulltextError } = await supabase.rpc('search_documents_fulltext', {
  search_query: 'mortgage',
  match_threshold: 0.0,
  match_count: 3,
  target_user_id: USER_ID,
});

if (fulltextError) {
  console.log('❌ search_documents_fulltext error:', fulltextError.message);
} else {
  console.log(`✅ search_documents_fulltext works! Found ${fulltext.length} results`);
  if (fulltext.length > 0) {
    console.log('   Sample result keys:', Object.keys(fulltext[0]));
  }
}

console.log('\n='.repeat(60));
console.log('DIAGNOSIS');
console.log('='.repeat(60));

if (matchError && fulltextError) {
  console.log('\n❌ PROBLEM: Both search functions are missing!');
  console.log('   The database migration has not been run in production');
  console.log('   Need to create the match_documents and search_documents_fulltext functions');
} else if (matchError) {
  console.log('\n⚠️  PROBLEM: match_documents is missing');
  console.log('   Vector search will not work');
} else if (fulltextError) {
  console.log('\n⚠️  PROBLEM: search_documents_fulltext is missing');
  console.log('   Full-text search will not work, but vector search will');
} else {
  console.log('\n✅ Both search functions exist!');
  console.log('   Search functionality should be working');
}
