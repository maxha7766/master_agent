import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

async function checkDocumentStatus() {
  console.log('Checking document in database...\n');

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, file_name, status, chunk_count, processing_progress, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('No documents found');
    return;
  }

  const doc = documents[0];
  console.log('Latest document:');
  console.log('  File:', doc.file_name);
  console.log('  Status:', doc.status);
  console.log('  Chunks:', doc.chunk_count);
  console.log('  Progress:', JSON.stringify(doc.processing_progress, null, 2));
  console.log('  Created:', doc.created_at);
}

checkDocumentStatus().catch(console.error);
