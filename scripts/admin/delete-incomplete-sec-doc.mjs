/**
 * Delete Incomplete SEC Football Document
 * Removes the document record that has no chunks
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteIncompleteDoc() {
  try {
    const docIds = ['04ad3ece-2331-405c-95f3-bc6d0842e3d0', '044f056a-2567-4b1b-84ac-64e3136e864e'];

    for (const docId of docIds) {

    // Delete any chunks (if any)
    const { error: chunksError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', docId);

    if (chunksError) {
      console.log('Note: Could not delete chunks:', chunksError.message);
    } else {
      console.log('✓ Deleted any existing chunks');
    }

    // Delete the document
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (docError) {
      throw new Error(`Failed to delete document: ${docError.message}`);
    }

    console.log('✓ Deleted incomplete document:', docId);
    }

    console.log('\n✓ All incomplete documents deleted');
    console.log('You can now run add-sec-report-to-rag-simple.mjs again');
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteIncompleteDoc();
