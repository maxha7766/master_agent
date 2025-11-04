import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyChunks() {
  console.log('=== VERIFYING CHUNKS TABLE ===\n');

  // Get Godfather document
  const { data: docs } = await supabase
    .from('documents')
    .select('id, file_name, user_id, chunk_count')
    .eq('file_name', 'The Godfather - PDF Room.pdf');

  if (!docs || docs.length === 0) {
    console.log('No Godfather document found');
    return;
  }

  const godfatherDoc = docs[0];
  console.log('Godfather document:', godfatherDoc);

  // Check chunks table
  const { count, error: countError } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', godfatherDoc.id);

  console.log('\nTotal chunks in chunks table:', count);
  if (countError) {
    console.error('Count error:', countError);
  }

  // Get sample chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('chunks')
    .select('id, content, chunk_index, embedding')
    .eq('document_id', godfatherDoc.id)
    .order('chunk_index')
    .limit(5);

  console.log('\nSample chunks:', chunks?.length || 0);
  if (chunksError) {
    console.error('Chunks error:', chunksError);
  }

  if (chunks && chunks.length > 0) {
    chunks.forEach(chunk => {
      console.log(`\n--- Chunk ${chunk.chunk_index} ---`);
      console.log('Has embedding:', chunk.embedding ? 'YES (length: ' + chunk.embedding.length + ')' : 'NO');
      console.log('Content:', chunk.content.substring(0, 200));
    });
  }

  // Search for chunks with "Vito" or "Corleone"
  const { data: vitoChunks } = await supabase
    .from('chunks')
    .select('id, content, chunk_index')
    .eq('document_id', godfatherDoc.id)
    .ilike('content', '%Corleone%')
    .limit(3);

  console.log('\n=== CHUNKS WITH "CORLEONE" ===');
  console.log('Count:', vitoChunks?.length || 0);
  if (vitoChunks && vitoChunks.length > 0) {
    vitoChunks.forEach(chunk => {
      console.log(`\nChunk ${chunk.chunk_index}:`);
      console.log(chunk.content.substring(0, 300));
    });
  }
}

verifyChunks().catch(console.error);
