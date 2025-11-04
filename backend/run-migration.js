import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync(join(__dirname, '..', 'add-sources-metadata.sql'), 'utf8');

console.log('🔄 Running migration to add sources_used column...\n');

// Split by semicolon and run each statement
const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

for (const statement of statements) {
  if (!statement.trim()) continue;

  console.log('Executing:', statement.substring(0, 60).replace(/\n/g, ' ') + '...');

  const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

  if (error) {
    console.log('⚠️  RPC method not available, migration may need manual execution');
    console.log('   Error:', error.message);
  } else {
    console.log('✅ Statement executed successfully');
  }
}

console.log('\n📋 Verifying migration...');

// Check if column exists by trying to query it
const { data, error } = await supabase
  .from('messages')
  .select('id, content, sources_used')
  .limit(1);

if (error) {
  console.error('\n❌ Migration verification failed:', error.message);
  console.log('\n💡 Please run this SQL manually in Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/' + process.env.SUPABASE_PROJECT_ID + '/sql/new\n');
  console.log(sql);
  process.exit(1);
} else {
  console.log('✅ Migration verified successfully!');
  console.log('✅ sources_used column has been added to messages table\n');
  process.exit(0);
}
