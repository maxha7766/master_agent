import { supabase } from './src/models/database.js';
import { documentProcessor } from './src/services/documents/processor.js';

console.log('Finding Georgia football research document...\n');

// Get the failed Georgia research document
const { data: doc, error: docError } = await supabase
  .from('documents')
  .select('*')
  .ilike('file_name', '%georgia%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (docError || !doc) {
  console.error('Document not found:', docError);
  process.exit(1);
}

console.log(`Found document: ${doc.file_name}`);
console.log(`Document ID: ${doc.id}`);
console.log(`Status: ${doc.status}`);
console.log(`Created: ${doc.created_at}\n`);

// Get the research project to retrieve the report content
const { data: project, error: projectError } = await supabase
  .from('research_projects')
  .select('*')
  .ilike('topic', '%georgia%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (projectError || !project) {
  console.error('Research project not found:', projectError);
  process.exit(1);
}

console.log(`Found research project: ${project.topic}`);
console.log(`Project ID: ${project.id}`);
console.log(`Status: ${project.status}`);

if (!project.final_report) {
  console.error('No final report in project');
  process.exit(1);
}

console.log(`Report length: ${project.final_report.length} characters\n`);

console.log('Starting document reprocessing...');
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
    .eq('id', doc.id);

  // Process the document (pass string content directly)
  await documentProcessor.processDocument(
    doc.id,
    project.user_id,
    project.final_report,
    doc.file_name
  );

  console.log('\n✅ Document processed successfully!');

  // Verify chunks were created
  const { count: chunkCount } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', doc.id);

  const { count: embeddedCount } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', doc.id)
    .not('embedding', 'is', null);

  console.log(`\nChunks created: ${chunkCount || 0}`);
  console.log(`Chunks with embeddings: ${embeddedCount || 0}`);

  if (chunkCount && embeddedCount && chunkCount === embeddedCount) {
    console.log('\n✅ All chunks have embeddings!');
    console.log('The Georgia football research report is now searchable in RAG.');
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

console.log('\nDone!');
process.exit(0);
