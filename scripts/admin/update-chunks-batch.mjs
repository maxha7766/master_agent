import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateChunks() {
  const fromUserId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
  const toUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab';

  console.log('=== UPDATING CHUNKS ===');

  // Get all document IDs that were transferred
  const { data: docs } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', toUserId);

  console.log('Documents to update chunks for:', docs.length);

  // Update chunks for each document
  let totalUpdated = 0;
  for (const doc of docs) {
    const { count, error } = await supabase
      .from('chunks')
      .update({ user_id: toUserId })
      .eq('document_id', doc.id)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error updating chunks for doc', doc.id, ':', error.message);
    } else {
      console.log('Updated', count, 'chunks for doc', doc.id);
      totalUpdated += count || 0;
    }
  }

  console.log('\n=== TOTAL CHUNKS UPDATED:', totalUpdated, '===');
}

updateChunks().catch(console.error);
