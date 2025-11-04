import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function transferDocuments() {
  const fromUserId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9'; // heath.maxwell@gmail.com
  const toUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab'; // test@example.com

  console.log('=== TRANSFERRING DOCUMENTS ===');
  console.log('From:', fromUserId, '(heath.maxwell@gmail.com)');
  console.log('To:', toUserId, '(test@example.com)');

  // Update documents table
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId)
    .select('id, file_name');

  if (docsError) {
    console.error('Error updating documents:', docsError);
    return;
  }

  console.log('\nDocuments updated:', docs.length);
  docs.forEach(d => console.log('-', d.file_name));

  // Update chunks table
  const { count: chunksCount, error: chunksError } = await supabase
    .from('chunks')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId)
    .select('*', { count: 'exact', head: true });

  if (chunksError) {
    console.error('Error updating chunks:', chunksError);
  } else {
    console.log('\nChunks updated:', chunksCount);
  }

  // Update tabular_data table if it exists
  const { count: tabularCount, error: tabularError } = await supabase
    .from('tabular_data')
    .update({ user_id: toUserId })
    .eq('user_id', fromUserId)
    .select('*', { count: 'exact', head: true });

  if (tabularError && !tabularError.message.includes('relation')) {
    console.error('Error updating tabular_data:', tabularError);
  } else if (!tabularError) {
    console.log('Tabular data rows updated:', tabularCount);
  }

  console.log('\n=== TRANSFER COMPLETE ===');
}

transferDocuments().catch(console.error);
