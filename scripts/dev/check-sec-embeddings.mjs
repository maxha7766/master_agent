import { supabase } from './src/models/database.js';

const { data: secDoc } = await supabase
  .from('documents')
  .select('id')
  .eq('file_name', 'graduate_research_SEC_Football_History_Traditions_and_Rivalries.md')
  .single();

if (secDoc) {
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('id, content, embedding, chunk_index')
    .eq('document_id', secDoc.id)
    .order('chunk_index')
    .limit(5);

  console.log('SEC Football Document Chunks:\n');
  chunks?.forEach(c => {
    console.log(`Chunk ${c.chunk_index}:`);
    console.log(`  Has embedding: ${c.embedding ? 'YES' : 'NO'}`);
    console.log(`  Content: ${c.content.substring(0, 150)}...\n`);
  });

  // Count total chunks with and without embeddings
  const { data: withEmbeddings } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', secDoc.id)
    .not('embedding', 'is', null);

  const { data: withoutEmbeddings } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', secDoc.id)
    .is('embedding', null);

  console.log(`\nTotal chunks with embeddings: ${withEmbeddings?.length || 0}`);
  console.log(`Total chunks without embeddings: ${withoutEmbeddings?.length || 0}`);
}

process.exit(0);
