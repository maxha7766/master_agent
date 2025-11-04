#!/usr/bin/env node
/**
 * Check what's actually in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('=== Database Inspection ===\n');

try {
  // Check total chunks
  const { count: totalCount } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total chunks in database: ${totalCount}`);

  // Check chunks for this user
  const { data: userChunks, count: userCount } = await supabase
    .from('chunks')
    .select('id, content, embedding', { count: 'exact' })
    .eq('user_id', userId);

  console.log(`👤 Chunks for user ${userId}: ${userCount}`);

  // Check how many have embeddings
  const chunksWithEmbeddings = userChunks?.filter(c => c.embedding !== null) || [];
  console.log(`🔢 Chunks with embeddings: ${chunksWithEmbeddings.length}`);

  // Search for chunks containing "balk"
  const { data: balkChunks, count: balkCount } = await supabase
    .from('chunks')
    .select('id, content, embedding', { count: 'exact' })
    .eq('user_id', userId)
    .ilike('content', '%balk%');

  console.log(`⚾ Chunks containing "balk": ${balkCount}`);

  if (balkChunks && balkChunks.length > 0) {
    console.log(`\n✅ Sample balk chunk:`);
    console.log(`   ID: ${balkChunks[0].id}`);
    console.log(`   Has embedding: ${balkChunks[0].embedding !== null}`);
    console.log(`   Content: ${balkChunks[0].content.substring(0, 200)}...`);
  }

  // Check if embeddings exist
  if (chunksWithEmbeddings.length === 0) {
    console.log(`\n❌ PROBLEM: No chunks have embeddings! This is why vector search returns nothing.`);
  } else if (chunksWithEmbeddings.length < userCount) {
    console.log(`\n⚠️  WARNING: Only ${chunksWithEmbeddings.length}/${userCount} chunks have embeddings`);
  } else {
    console.log(`\n✅ All chunks have embeddings`);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
