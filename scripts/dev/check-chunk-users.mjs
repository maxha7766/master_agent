import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkChunks() {
  const testUserId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab';
  const heathUserId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

  console.log('=== CHECKING CHUNK USER_IDs ===\n');

  // Get Godfather document
  const { data: docs } = await supabase
    .from('documents')
    .select('id, file_name, user_id')
    .eq('file_name', 'The Godfather - PDF Room.pdf');

  const godfatherDoc = docs[0];
  console.log('Godfather document:');
  console.log('  ID:', godfatherDoc.id);
  console.log('  User ID:', godfatherDoc.user_id);
  console.log('  Is test user:', godfatherDoc.user_id === testUserId);

  // Check chunk user_ids for this document
  const { data: chunks } = await supabase
    .from('chunks')
    .select('id, user_id')
    .eq('document_id', godfatherDoc.id)
    .limit(5);

  console.log('\nSample chunks from Godfather:');
  if (chunks && chunks.length > 0) {
    chunks.forEach((chunk, i) => {
      console.log(`  [${i + 1}] Chunk user_id:`, chunk.user_id);
      console.log('      Is test user:', chunk.user_id === testUserId);
      console.log('      Is heath user:', chunk.user_id === heathUserId);
    });
  } else {
    console.log('  No chunks found');
  }

  // Count chunks by user
  const { count: testCount } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', testUserId);

  const { count: heathCount } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', heathUserId);

  console.log('\n=== CHUNK COUNTS BY USER ===');
  console.log('Test user chunks:', testCount);
  console.log('Heath user chunks:', heathCount);
}

checkChunks().catch(console.error);
