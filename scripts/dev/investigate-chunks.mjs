import { supabase } from './src/models/database.js';

// Get the chunks that were actually returned in the search
const chunkContents = [
  '89\n7. 03 \tForfeited Games',
  '17 \tWinning and Losing Pitcher .  135\n9. 18 \tShutouts',
  '18\n5. 04 \tBatting',
  'An OUT is one of the three required retirements of an offens'
];

console.log('Searching for these chunk contents in the database...\n');

for (const content of chunkContents) {
  const { data: chunk } = await supabase
    .from('document_chunks')
    .select('document_id, chunk_index, content')
    .ilike('content', content + '%')
    .limit(1)
    .single();

  if (chunk) {
    const { data: doc } = await supabase
      .from('documents')
      .select('file_name')
      .eq('id', chunk.document_id)
      .single();

    console.log(`Content: ${content.substring(0, 50)}...`);
    console.log(`Document: ${doc?.file_name}`);
    console.log(`Chunk index: ${chunk.chunk_index}\n`);
  }
}

// Now check the SEC football document specifically
console.log('\n=== Checking SEC Football Document ===\n');

const { data: secDoc } = await supabase
  .from('documents')
  .select('id, file_name, chunk_count')
  .eq('file_name', 'graduate_research_SEC_Football_History_Traditions_and_Rivalries.md')
  .single();

if (secDoc) {
  console.log(`Document: ${secDoc.file_name}`);
  console.log(`Chunk count: ${secDoc.chunk_count}`);

  const { count: withEmbeddings } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', secDoc.id)
    .not('embedding', 'is', null);

  const { count: totalChunks } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', secDoc.id);

  console.log(`Chunks with embeddings: ${withEmbeddings || 0} / ${totalChunks || 0}`);

  // Get first few chunks
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('chunk_index, content, embedding')
    .eq('document_id', secDoc.id)
    .order('chunk_index')
    .limit(3);

  console.log('\nFirst 3 chunks:');
  chunks?.forEach(c => {
    console.log(`\nChunk ${c.chunk_index}:`);
    console.log(`Has embedding: ${c.embedding ? 'YES (' + c.embedding.length + ' dimensions)' : 'NO'}`);
    console.log(`Content preview: ${c.content.substring(0, 200)}`);
  });
}

process.exit(0);
