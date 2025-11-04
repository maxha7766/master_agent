import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_PUBLIC
);

async function checkAllDocs() {
  console.log('Checking all documents across all users...\n');

  // Get all documents without user filter
  const { data: allDocs, error } = await supabase
    .from('documents')
    .select('id, file_name, user_id, status, chunk_count')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const docCount = allDocs ? allDocs.length : 0;
  console.log(`Total documents: ${docCount}\n`);

  // Group by user
  const byUser = {};
  if (allDocs) {
    allDocs.forEach(doc => {
      if (!byUser[doc.user_id]) {
        byUser[doc.user_id] = [];
      }
      byUser[doc.user_id].push(doc);
    });
  }

  Object.entries(byUser).forEach(([userId, docs]) => {
    console.log(`\n=== User: ${userId} ===`);
    console.log(`Document count: ${docs.length}`);
    docs.forEach(doc => {
      const chunks = doc.chunk_count || 0;
      console.log(`  - ${doc.file_name} (${doc.status}, chunks: ${chunks})`);
    });
  });

  // Check for chunks too
  const { data: chunks, error: chunksError } = await supabase
    .from('chunks')
    .select('user_id, document_id')
    .limit(10);

  if (chunksError) {
    console.error('\nError checking chunks:', chunksError);
  } else {
    const chunkCount = chunks ? chunks.length : 0;
    console.log(`\n\nSample chunks found: ${chunkCount}`);
    if (chunks && chunks.length > 0) {
      const userIds = [...new Set(chunks.map(c => c.user_id))];
      console.log('Chunk user IDs:', userIds);
    }
  }
}

checkAllDocs().catch(console.error);
