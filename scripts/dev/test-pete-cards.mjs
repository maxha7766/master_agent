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

console.log('Testing what Pete Crow-Armstrong cards are actually in the database...\n');

const sql = `SELECT row_data->>'Item number' as item_number, row_data->>'Title' as title, row_data->>'Current price' as current_price FROM document_data WHERE document_id = '${documentId}' AND LOWER(row_data->>'Title') LIKE '%pete crow-armstrong%' ORDER BY (row_data->>'Current price')::numeric DESC`;

console.log('SQL:', sql);
console.log('\n');

const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_tabular_query', {
  p_user_id: userId,
  p_query: sql,
});

if (rpcError) {
  console.error('❌ RPC Error:', rpcError);
  process.exit(1);
}

console.log(`Found ${rpcResult.row_count} Pete Crow-Armstrong cards:\n`);

rpcResult.data.forEach((row, i) => {
  console.log(`${i + 1}. Item #${row.item_number}`);
  console.log(`   ${row.title}`);
  console.log(`   Price: $${row.current_price}\n`);
});

process.exit(0);
