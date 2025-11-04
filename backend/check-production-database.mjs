#!/usr/bin/env node
/**
 * Check Production Database State
 * Verifies documents, users, and configurations
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('='.repeat(60));
console.log('PRODUCTION DATABASE VERIFICATION');
console.log('='.repeat(60));

// Check users
console.log('\n1. Checking Users...');
const { data: users, error: usersError } = await supabase
  .from('users')
  .select('id, email, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (usersError) {
  console.log('❌ Error fetching users:', usersError.message);
} else {
  console.log(`✅ Found ${users.length} users`);
  users.forEach((user, i) => {
    console.log(`   ${i + 1}. ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
  });
}

// Check documents for each user
if (users && users.length > 0) {
  console.log('\n2. Checking Documents per User...');
  for (const user of users) {
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, title, file_type, chunk_count, created_at')
      .eq('user_id', user.id);

    if (docsError) {
      console.log(`   ❌ Error fetching documents for ${user.email}:`, docsError.message);
    } else {
      console.log(`   ${user.email}: ${docs.length} documents`);
      if (docs.length > 0) {
        docs.forEach(doc => {
          console.log(`      - ${doc.title} (${doc.file_type}, ${doc.chunk_count || 0} chunks)`);
        });
      }
    }
  }
}

// Check total chunks
console.log('\n3. Checking Document Chunks...');
const { data: chunks, error: chunksError } = await supabase
  .from('document_chunks')
  .select('id, document_id, user_id', { count: 'exact' });

if (chunksError) {
  console.log('❌ Error fetching chunks:', chunksError.message);
} else {
  console.log(`✅ Total chunks in database: ${chunks.length}`);

  // Group by user
  const chunksByUser = chunks.reduce((acc, chunk) => {
    acc[chunk.user_id] = (acc[chunk.user_id] || 0) + 1;
    return acc;
  }, {});

  console.log('   Chunks by user:');
  Object.entries(chunksByUser).forEach(([userId, count]) => {
    const user = users?.find(u => u.id === userId);
    console.log(`      ${user?.email || userId.substring(0, 8)}: ${count} chunks`);
  });
}

// Check conversations
console.log('\n4. Checking Conversations...');
const { data: conversations, error: convsError } = await supabase
  .from('conversations')
  .select('id, user_id, title, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (convsError) {
  console.log('❌ Error fetching conversations:', convsError.message);
} else {
  console.log(`✅ Found ${conversations.length} recent conversations`);
  conversations.forEach((conv, i) => {
    const user = users?.find(u => u.id === conv.user_id);
    console.log(`   ${i + 1}. "${conv.title}" by ${user?.email || 'unknown'}`);
  });
}

// Check settings
console.log('\n5. Checking User Settings...');
const { data: settings, error: settingsError } = await supabase
  .from('user_settings')
  .select('user_id, default_chat_model, monthly_budget_limit, rag_model');

if (settingsError) {
  console.log('❌ Error fetching settings:', settingsError.message);
} else {
  console.log(`✅ Found settings for ${settings.length} users`);
  settings.forEach(s => {
    const user = users?.find(u => u.id === s.user_id);
    console.log(`   ${user?.email || s.user_id.substring(0, 8)}: ${s.default_chat_model} (budget: $${s.monthly_budget_limit})`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

console.log('\n📊 Database Health:');
console.log(`   Users: ${users?.length || 0}`);
console.log(`   Documents: Check per user above`);
console.log(`   Chunks: ${chunks?.length || 0}`);
console.log(`   Conversations: ${conversations?.length || 0}`);
console.log(`   Settings: ${settings?.length || 0}`);

console.log('\n🔍 Issues to Check:');
if (!users || users.length === 0) {
  console.log('   ⚠️  No users found - need to create accounts');
}
if (!chunks || chunks.length === 0) {
  console.log('   ⚠️  No document chunks found - no knowledge base data');
  console.log('   ℹ️  Users need to upload documents via the UI');
}
if (!settings || settings.length === 0) {
  console.log('   ⚠️  No user settings found - may need migration');
}

console.log('\n' + '='.repeat(60));
