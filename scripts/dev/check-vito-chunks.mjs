import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkChunks() {
  // Get all documents
  const { data: docs, error: docError } = await supabase
    .from('documents')
    .select('id, file_name, chunk_count, status')
    .eq('status', 'completed');

  console.log('=== DOCUMENTS ===');
  console.log(JSON.stringify(docs, null, 2));

  // Find Godfather document
  const godfatherDoc = docs?.find(d => d.file_name.toLowerCase().includes('godfather'));

  if (!godfatherDoc) {
    console.log('No Godfather document found');
    return;
  }

  console.log('\n=== GODFATHER DOC ===');
  console.log(JSON.stringify(godfatherDoc, null, 2));

  // Check chunks with 'Vito' in content
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('id, document_id, content, chunk_index')
    .eq('document_id', godfatherDoc.id)
    .ilike('content', '%Vito%')
    .limit(5);

  console.log('\n=== CHUNKS WITH "VITO" ===');
  console.log('Count:', chunks?.length || 0);
  if (chunks && chunks.length > 0) {
    chunks.forEach(chunk => {
      console.log('\n--- Chunk', chunk.chunk_index, '---');
      console.log(chunk.content.substring(0, 300));
    });
  }
}

checkChunks().catch(console.error);
