import { supabase } from './src/models/database.js';

const docId = 'b810be2f-d58a-4c17-9038-ad96ff97a46d';

console.log('Checking chunks table...\n');

// Check the 'chunks' table
const { count: totalChunks } = await supabase
  .from('chunks')
  .select('id', { count: 'exact', head: true })
  .eq('document_id', docId);

const { count: withEmbeddings } = await supabase
  .from('chunks')
  .select('id', { count: 'exact', head: true })
  .eq('document_id', docId)
  .not('embedding', 'is', null);

console.log(`Total chunks for SEC Football doc: ${totalChunks}`);
console.log(`Chunks with embeddings: ${withEmbeddings}`);

if (totalChunks > 0) {
  const { data: sample } = await supabase
    .from('chunks')
    .select('chunk_index, content, embedding')
    .eq('document_id', docId)
    .order('chunk_index')
    .limit(3);

  console.log(`\nFirst 3 chunks:`);
  sample?.forEach(c => {
    console.log(`\nChunk ${c.chunk_index}:`);
    console.log(`  Content: ${c.content.substring(0, 150)}...`);
    console.log(`  Has embedding: ${c.embedding ? 'YES (' + c.embedding.length + ' dims)' : 'NO'}`);
  });
} else {
  console.log('\n⚠️  No chunks found for this document!');

  // Check total chunks in table
  const { count: allChunks } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true });

  console.log(`\nTotal chunks in entire table: ${allChunks}`);
}

process.exit(0);
