import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Checking document_data table for Ebay listings...\n');

// Find Ebay document ID
const { data: docs, error: docError } = await supabase
  .from('documents')
  .select('id, file_name, row_count')
  .ilike('file_name', '%ebay%')
  .order('created_at', { ascending: false })
  .limit(1);

if (docError) {
  console.error('Error fetching document:', docError);
  process.exit(1);
}

if (!docs || docs.length === 0) {
  console.log('No Ebay documents found');
  process.exit(0);
}

const doc = docs[0];
console.log(`Found Ebay document:`);
console.log(`  ID: ${doc.id}`);
console.log(`  File: ${doc.file_name}`);
console.log(`  Expected rows: ${doc.row_count}\n`);

// Check document_data table
const { count, error: countError } = await supabase
  .from('document_data')
  .select('id', { count: 'exact', head: true })
  .eq('document_id', doc.id);

if (countError) {
  console.error('Error counting document_data:', countError);
  process.exit(1);
}

console.log(`Actual rows in document_data: ${count || 0}\n`);

if (count === 0) {
  console.log('❌ NO DATA FOUND! The Ebay CSV data has not been inserted into document_data table.');
  console.log('\nThis is why queries are returning 0 results.');
} else if (count !== doc.row_count) {
  console.log(`⚠️  Row count mismatch! Expected ${doc.row_count}, found ${count}`);
} else {
  console.log('✅ Data looks good! Let me fetch a sample...\n');

  // Get sample row
  const { data: sample, error: sampleError } = await supabase
    .from('document_data')
    .select('row_data, row_index')
    .eq('document_id', doc.id)
    .order('row_index')
    .limit(1);

  if (sampleError) {
    console.error('Error fetching sample:', sampleError);
  } else if (sample && sample.length > 0) {
    console.log('Sample row:');
    console.log(JSON.stringify(sample[0], null, 2));
  }
}

process.exit(0);
