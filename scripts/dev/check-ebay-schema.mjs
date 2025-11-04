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

console.log('Checking Ebay CSV document schema...\n');

// Find Ebay document
const { data: docs, error } = await supabase
  .from('documents')
  .select('id, file_name, user_description, semantic_schema, row_count, column_count')
  .ilike('file_name', '%ebay%')
  .order('created_at', { ascending: false });

if (error) {
  console.error('Error fetching documents:', error);
  process.exit(1);
}

if (!docs || docs.length === 0) {
  console.log('No Ebay documents found');
  process.exit(0);
}

console.log(`Found ${docs.length} Ebay document(s):\n`);

docs.forEach((doc, i) => {
  console.log(`=== Document ${i + 1} ===`);
  console.log(`ID: ${doc.id}`);
  console.log(`File: ${doc.file_name}`);
  console.log(`Rows: ${doc.row_count}, Columns: ${doc.column_count}`);
  console.log(`User Description: ${doc.user_description || 'None'}`);
  console.log(`\nSemantic Schema:`);
  console.log(JSON.stringify(doc.semantic_schema, null, 2));
  console.log('\n');
});

process.exit(0);
