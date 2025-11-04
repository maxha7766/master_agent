import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDocument() {
  const docId = '9df7d9c8-e2a2-4992-aac4-9e6319ec59f7';
  const userId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab';

  console.log('=== GODFATHER DOCUMENT ===');
  console.log(`Document ID: ${docId}`);
  console.log(`User ID: ${userId}`);
  console.log(`File: The Godfather - PDF Room.pdf`);
  console.log(`Chunks: 519`);
  console.log(`Status: completed\n`);

  // Check chunks for this document
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, chunk_index, page_number, user_id')
    .eq('document_id', docId)
    .limit(5);

  if (error) {
    console.error('Error fetching chunks:', error);
  } else {
    const chunkCount = chunks ? chunks.length : 0;
    console.log(`Chunks in database: ${chunkCount}`);
    if (chunks && chunks.length > 0) {
      console.log('Sample chunks:');
      chunks.forEach(c => {
        console.log(`  - Chunk ${c.chunk_index}, Page ${c.page_number}, User: ${c.user_id}`);
      });
    }
  }

  // Check if there are any Vito chunks
  const { data: vitoChunks, error: vitoError } = await supabase
    .from('chunks')
    .select('id, chunk_index, page_number, content')
    .eq('document_id', docId)
    .ilike('content', '%Vito%')
    .limit(3);

  if (vitoError) {
    console.error('\nError searching for Vito chunks:', vitoError);
  } else {
    const vitoCount = vitoChunks ? vitoChunks.length : 0;
    console.log(`\nChunks mentioning "Vito": ${vitoCount}`);
    if (vitoChunks && vitoChunks.length > 0) {
      vitoChunks.forEach(c => {
        console.log(`\n--- Chunk ${c.chunk_index}, Page ${c.page_number} ---`);
        console.log(c.content.substring(0, 200) + '...');
      });
    }
  }

  // Check all users with documents
  console.log('\n\n=== ALL USERS WITH DOCUMENTS ===');
  const { data: allDocs } = await supabase
    .from('documents')
    .select('user_id, file_name')
    .order('created_at', { ascending: false });

  const userDocs = {};
  if (allDocs) {
    allDocs.forEach(doc => {
      if (!userDocs[doc.user_id]) {
        userDocs[doc.user_id] = [];
      }
      userDocs[doc.user_id].push(doc.file_name);
    });
  }

  Object.entries(userDocs).forEach(([uid, docs]) => {
    console.log(`\nUser: ${uid}`);
    console.log(`Documents: ${docs.length}`);
    docs.forEach(d => console.log(`  - ${d}`));
  });

  // Now check what user the frontend is using
  console.log('\n\n=== FRONTEND USER CHECK ===');
  console.log('Check your frontend localStorage for:');
  console.log('- supabase.auth.token');
  console.log('- Or check browser dev tools -> Application -> Local Storage');
}

checkDocument().catch(console.error);
