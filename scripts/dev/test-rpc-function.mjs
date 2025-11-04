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

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
const documentId = 'c62193e5-b51e-4209-982c-8cadb052f3c7';

console.log('Testing RPC function execute_tabular_query...\n');

// Test 1: Simple count query
const query1 = `SELECT COUNT(*) as total_listings FROM document_data WHERE document_id = '${documentId}'`;
console.log('Test 1: Count query');
console.log(`SQL: ${query1}\n`);

const { data: result1, error: error1 } = await supabase.rpc('execute_tabular_query', {
  p_user_id: userId,
  p_query: query1,
});

if (error1) {
  console.error('❌ Error:', error1);
} else {
  console.log('✅ Result:', JSON.stringify(result1, null, 2));
}

console.log('\n---\n');

// Test 2: Top 5 prices query
const query2 = `SELECT row_data->>'Title' AS listing_title, row_data->>'Current price' AS price FROM document_data WHERE document_id = '${documentId}' ORDER BY (row_data->>'Current price')::numeric DESC LIMIT 5`;
console.log('Test 2: Top 5 prices query');
console.log(`SQL: ${query2}\n`);

const { data: result2, error: error2 } = await supabase.rpc('execute_tabular_query', {
  p_user_id: userId,
  p_query: query2,
});

if (error2) {
  console.error('❌ Error:', error2);
} else {
  console.log('✅ Result:', JSON.stringify(result2, null, 2));
}

process.exit(0);
