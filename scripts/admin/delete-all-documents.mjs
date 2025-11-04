import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllDocuments() {
  console.log('=== DELETING ALL DOCUMENT DATA ===\n');

  // Delete from chunks first (foreign key constraints)
  console.log('Deleting all chunks...');
  const { error: chunksError } = await supabase
    .from('chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (chunksError) {
    console.error('Error deleting chunks:', chunksError);
  } else {
    console.log('✅ All chunks deleted');
  }

  // Delete from tabular_data
  console.log('Deleting all tabular_data...');
  const { error: tabularError } = await supabase
    .from('tabular_data')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (tabularError) {
    console.error('Error deleting tabular_data:', tabularError);
  } else {
    console.log('✅ All tabular_data deleted');
  }

  // Delete from documents last
  console.log('Deleting all documents...');
  const { error: docsError } = await supabase
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (docsError) {
    console.error('Error deleting documents:', docsError);
  } else {
    console.log('✅ All documents deleted');
  }

  // Verify
  console.log('\n=== VERIFICATION ===');

  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  const { count: chunkCount } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true });

  const { count: tabularCount } = await supabase
    .from('tabular_data')
    .select('*', { count: 'exact', head: true });

  console.log(`Documents remaining: ${docCount || 0}`);
  console.log(`Chunks remaining: ${chunkCount || 0}`);
  console.log(`Tabular data remaining: ${tabularCount || 0}`);

  if ((docCount || 0) === 0 && (chunkCount || 0) === 0 && (tabularCount || 0) === 0) {
    console.log('\n✅ All document data successfully deleted! Ready to start fresh.');
  } else {
    console.log('\n⚠️ Some data may remain. Check the counts above.');
  }
}

deleteAllDocuments().catch(console.error);
