import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyEmptyTables() {
  console.log('=== VERIFYING ALL TABLES ARE EMPTY ===\n');

  // Check documents table
  const { count: docCount, error: docError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  if (docError) {
    console.error('Error checking documents:', docError);
  } else {
    console.log(`📄 documents table: ${docCount || 0} rows`);
  }

  // Check chunks table
  const { count: chunkCount, error: chunkError } = await supabase
    .from('chunks')
    .select('*', { count: 'exact', head: true });

  if (chunkError) {
    console.error('Error checking chunks:', chunkError);
  } else {
    console.log(`📦 chunks table: ${chunkCount || 0} rows`);
  }

  // Check document_data table
  const { count: dataCount, error: dataError } = await supabase
    .from('document_data')
    .select('*', { count: 'exact', head: true });

  if (dataError) {
    console.error('Error checking document_data:', dataError);
  } else {
    console.log(`📊 document_data table: ${dataCount || 0} rows`);
  }

  console.log('\n=== SUMMARY ===');
  const totalRows = (docCount || 0) + (chunkCount || 0) + (dataCount || 0);

  if (totalRows === 0) {
    console.log('✅ ALL TABLES ARE EMPTY - Ready to start fresh!');
  } else {
    console.log(`⚠️ Total rows remaining: ${totalRows}`);
    console.log('Some data still exists in the database.');
  }
}

verifyEmptyTables().catch(console.error);
