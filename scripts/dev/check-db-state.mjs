import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkState() {
  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  console.log('=== USER ===');
  console.log('User ID:', userId);

  // Check documents table
  console.log('\n=== DOCUMENTS TABLE ===');
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .eq('file_name', 'The Godfather - PDF Room.pdf');

  console.log('Godfather docs:', JSON.stringify(docs, null, 2));
  if (docsError) console.error('Error:', docsError);

  if (!docs || docs.length === 0) {
    console.log('No Godfather document found!');
    return;
  }

  const godfatherDoc = docs[0];

  // Check document_chunks table
  console.log('\n=== DOCUMENT_CHUNKS TABLE ===');
  const { count, error: countError } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', godfatherDoc.id);

  console.log('Total chunks for Godfather:', count);
  if (countError) console.error('Error:', countError);

  // Get a few sample chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('id, content, chunk_index, embedding')
    .eq('document_id', godfatherDoc.id)
    .limit(3);

  console.log('\n=== SAMPLE CHUNKS ===');
  if (chunks && chunks.length > 0) {
    chunks.forEach(chunk => {
      console.log(`\nChunk ${chunk.chunk_index}:`);
      console.log('ID:', chunk.id);
      console.log('Has embedding:', chunk.embedding ? 'YES' : 'NO');
      console.log('Content length:', chunk.content?.length || 0);
      console.log('Content preview:', chunk.content?.substring(0, 200));
    });
  } else {
    console.log('No chunks found!');
    console.error('Error:', chunksError);
  }

  // Check if user_id matches
  console.log('\n=== USER ID CHECK ===');
  console.log('Document user_id:', godfatherDoc.user_id);
  console.log('Auth user_id:', userId);
  console.log('Match:', godfatherDoc.user_id === userId);

  // Try direct query without user filter
  console.log('\n=== DIRECT CHUNK QUERY (NO USER FILTER) ===');
  const { data: allChunks, error: allChunksError } = await supabase
    .from('document_chunks')
    .select('id, document_id, content')
    .eq('document_id', godfatherDoc.id)
    .limit(5);

  console.log('Chunks found (no filter):', allChunks?.length || 0);
  if (allChunksError) console.error('Error:', allChunksError);
}

checkState().catch(console.error);
