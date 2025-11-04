import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function transferDocuments() {
  const fromUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab'; // test@example.com
  const toUserId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9'; // heath.maxwell@gmail.com

  console.log('=== TRANSFERRING DOCUMENTS ===');
  console.log(`From: test@example.com (${fromUserId})`);
  console.log(`To: heath.maxwell@gmail.com (${toUserId})\n`);

  // Get all documents for test user
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, chunk_count')
    .eq('user_id', fromUserId);

  if (docsError) {
    console.error('Error fetching documents:', docsError);
    return;
  }

  console.log(`Found ${documents.length} documents to transfer\n`);

  // Transfer documents
  const { error: updateDocsError } = await supabase
    .from('documents')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId);

  if (updateDocsError) {
    console.error('Error updating documents:', updateDocsError);
    return;
  }

  console.log('✅ Documents table updated');

  // Transfer chunks
  const { error: updateChunksError } = await supabase
    .from('chunks')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId);

  if (updateChunksError) {
    console.error('Error updating chunks:', updateChunksError);
    return;
  }

  console.log('✅ Chunks table updated');

  // Verify
  const { data: verifyDocs } = await supabase
    .from('documents')
    .select('id, file_name, chunk_count')
    .eq('user_id', toUserId);

  console.log(`\n✅ Transfer complete! heath.maxwell@gmail.com now has ${verifyDocs.length} documents:`);
  verifyDocs.forEach(d => {
    console.log(`  - ${d.file_name} (${d.chunk_count || 0} chunks)`);
  });
}

transferDocuments().catch(console.error);
