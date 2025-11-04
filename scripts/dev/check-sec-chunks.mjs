/**
 * Check SEC Football Report Chunks
 * Verify how many chunks were uploaded for the SEC football report
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkChunks() {
  try {
    // Find the SEC football document
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('*')
      .ilike('file_name', '%sec%football%')
      .order('created_at', { ascending: false });

    if (docError || !docs) {
      throw new Error(`Failed to find document: ${docError?.message}`);
    }

    console.log(`Found ${docs.length} SEC football documents:\n`);

    for (const doc of docs) {
      console.log(`Document: ${doc.file_name}`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Status: ${doc.status}`);
      console.log(`  Size: ${doc.file_size} bytes`);
      console.log(`  Chunk Count (from doc): ${doc.chunk_count || 'N/A'}`);

      // Count actual chunks
      const { count, error: countError } = await supabase
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc.id);

      if (countError) {
        console.log(`  Actual chunks: Error - ${countError.message}`);
      } else {
        console.log(`  Actual chunks: ${count}`);
      }

      console.log('');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkChunks();
