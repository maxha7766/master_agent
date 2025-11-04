import { supabase } from './src/models/database.js';
import { documentProcessor } from './src/services/documents/processor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DOCUMENT_ID = 'b810be2f-d58a-4c17-9038-ad96ff97a46d';
const USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('Re-processing SEC Football document...\n');

// Get the document
const { data: doc, error: docError } = await supabase
  .from('documents')
  .select('*')
  .eq('id', DOCUMENT_ID)
  .single();

if (docError || !doc) {
  console.error('Document not found:', docError);
  process.exit(1);
}

console.log(`Found document: ${doc.file_name}`);
console.log(`Status: ${doc.status}`);
console.log(`Processing status: ${doc.processing_status}`);
console.log(`File size: ${doc.file_size} bytes\n`);

// Read the markdown file from disk

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'sec-football-history-complete.md');

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const reportContent = fs.readFileSync(filePath, 'utf-8');
console.log(`Read file: sec-football-history-complete.md`);
console.log(`File length: ${reportContent.length} characters\n`);

console.log('Starting document processing...');
console.log('This will:');
console.log('  1. Chunk the document');
console.log('  2. Generate embeddings for each chunk');
console.log('  3. Store chunks in the database');
console.log('  4. Update document status\n');

try {
  // Update status to processing
  await supabase
    .from('documents')
    .update({
      status: 'processing',
      processing_status: 'processing'
    })
    .eq('id', DOCUMENT_ID);

  // Process the document (pass string content directly)
  await documentProcessor.processDocument(
    DOCUMENT_ID,
    USER_ID,
    reportContent,
    'graduate_research_SEC_Football_History_Traditions_and_Rivalries.md'
  );

  console.log('\n✅ Document processed successfully!');

  // Verify chunks were created
  const { count: chunkCount } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', DOCUMENT_ID);

  const { count: embeddedCount } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', DOCUMENT_ID)
    .not('embedding', 'is', null);

  console.log(`\nChunks created: ${chunkCount || 0}`);
  console.log(`Chunks with embeddings: ${embeddedCount || 0}`);

  if (chunkCount && embeddedCount && chunkCount === embeddedCount) {
    console.log('\n✅ All chunks have embeddings!');
  } else {
    console.log('\n⚠️ Some chunks may be missing embeddings');
  }

} catch (error) {
  console.error('\n❌ Processing failed:', error);
  console.error('Error details:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}

console.log('\nDone! The SEC Football document should now be searchable.');
process.exit(0);
