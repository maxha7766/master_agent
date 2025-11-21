/**
 * Setup Global Excel Knowledge
 * Makes Excel documentation globally accessible to all users
 */

import { supabase } from '../src/models/database.js';
import { log } from '../src/lib/logger.js';

async function setupGlobalExcelKnowledge() {
  console.log('🔧 Setting up global Excel knowledge...\n');

  // Step 1: Update existing Excel chunks to have user_id = NULL
  console.log('Step 1: Updating Excel chunks to be globally accessible...');

  const { error: updateError, count } = await supabase
    .from('chunks')
    .update({ user_id: null })
    .or('metadata->>source_type.eq.microsoft_docs,metadata->>source_type.eq.third_party')
    .not('metadata->>doc_category', 'is', null);

  if (updateError) {
    console.error('❌ Failed to update chunks:', updateError.message);
    throw updateError;
  }

  console.log(`✅ Updated ${count} Excel chunks to be globally accessible\n`);

  // Step 2: Get first user and create document for them (system knowledge available to all)
  console.log('Step 2: Creating system document entry...');

  // Get the first user in the system
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.log('⚠️  No users found - skipping document creation');
    console.log('   Document not required - chunks are globally accessible\n');
    return;
  }

  const firstUserId = users[0].id;

  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id')
    .eq('file_name', 'Excel Function Knowledge')
    .eq('user_id', firstUserId)
    .single();

  if (existingDoc) {
    console.log('ℹ️  System document already exists, skipping creation\n');
    return;
  }

  const { data: systemDoc, error: docError } = await supabase
    .from('documents')
    .insert({
      file_name: 'Excel Function Knowledge',
      file_type: 'system',
      file_size: 1,
      file_url: 'system://excel-knowledge',
      status: 'completed',
      user_id: firstUserId,
      summary: 'Detailed knowledge about Excel functions including formulas, syntax, examples, and troubleshooting. Covers all major function categories: Lookup & Reference, Text, Logical, Math & Trig, Date & Time, Financial, Statistical, Engineering, Information, and Database functions.',
      title: 'Excel Function Knowledge',
    })
    .select()
    .single();

  if (docError) {
    console.error('❌ Failed to create system document:', docError.message);
    throw docError;
  }

  console.log(`✅ Created system document: "${systemDoc.file_name}" for user ${firstUserId}\n`);

  // Step 3: Update the match_documents function
  console.log('Step 3: Updating match_documents function...');
  console.log('ℹ️  You need to run this SQL in Supabase SQL Editor:\n');

  const updateFunctionSQL = `
-- Updated match_documents function to include global knowledge
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  target_user_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  page_number int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.chunk_index,
    chunks.page_number,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  LEFT JOIN documents ON chunks.document_id = documents.id
  WHERE
    (
      -- User's own documents
      documents.user_id = target_user_id
      OR
      -- Global knowledge (user_id is NULL)
      documents.user_id IS NULL
      OR
      -- Chunks without a document_id (legacy support)
      chunks.document_id IS NULL AND chunks.user_id IS NULL
    )
    AND (1 - (chunks.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
`;

  console.log(updateFunctionSQL);
  console.log('\n📋 Copy the SQL above and run it in Supabase SQL Editor');
  console.log('   Dashboard → SQL Editor → New Query → Paste & Run\n');

  console.log('✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run the SQL above in Supabase SQL Editor');
  console.log('2. Test by asking Master Agent: "How do I use VLOOKUP in Excel?"\n');
}

setupGlobalExcelKnowledge()
  .then(() => {
    log.info('Global Excel knowledge setup complete');
    process.exit(0);
  })
  .catch((error) => {
    log.error('Setup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
