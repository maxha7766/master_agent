const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

async function cleanAllDocuments() {
  console.log('Fetching all documents...');

  // Get all documents
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name');

  if (docsError) {
    console.error('Error fetching documents:', docsError);
    return;
  }

  console.log(`Found ${documents.length} documents`);

  for (const doc of documents) {
    console.log(`Deleting document: ${doc.file_name} (${doc.id})`);

    // Delete chunks first
    const { error: chunksError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', doc.id);

    if (chunksError) {
      console.error(`  Error deleting chunks: ${chunksError.message}`);
    } else {
      console.log(`  Chunks deleted`);
    }

    // Delete document
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id);

    if (docError) {
      console.error(`  Error deleting document: ${docError.message}`);
    } else {
      console.log(`  Document deleted`);
    }
  }

  console.log('\nCleanup complete!');
}

cleanAllDocuments().catch(console.error);
