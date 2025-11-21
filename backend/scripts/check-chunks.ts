import { supabase } from '../src/models/database.js';

async function checkChunks() {
  // Get one Excel chunk
  const { data: excelChunks, error: excelError } = await supabase
    .from('chunks')
    .select('*')
    .eq('metadata->>source_type', 'microsoft_docs')
    .limit(1);

  if (excelError) {
    console.error('Error fetching Excel chunk:', excelError);
  } else if (excelChunks && excelChunks.length > 0) {
    console.log('\n=== Excel Chunk Structure ===');
    console.log('Columns:', Object.keys(excelChunks[0]));
    console.log('\nSample chunk:');
    console.log('- id:', excelChunks[0].id);
    console.log('- document_id:', excelChunks[0].document_id);
    console.log('- user_id:', excelChunks[0].user_id);
    console.log('- content length:', excelChunks[0].content?.length || 0);
    console.log('- metadata:', excelChunks[0].metadata);
  }

  // Get one regular user chunk for comparison
  const { data: userChunks, error: userError } = await supabase
    .from('chunks')
    .select('*')
    .not('metadata->>source_type', 'in', '(microsoft_docs,third_party)')
    .limit(1);

  if (userError) {
    console.error('\nError fetching user chunk:', userError);
  } else if (userChunks && userChunks.length > 0) {
    console.log('\n=== Regular User Chunk Structure ===');
    console.log('- id:', userChunks[0].id);
    console.log('- document_id:', userChunks[0].document_id);
    console.log('- user_id:', userChunks[0].user_id);
    console.log('- metadata:', userChunks[0].metadata);
  }

  process.exit(0);
}

checkChunks();
