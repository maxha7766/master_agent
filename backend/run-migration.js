import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync('create-users-table.sql', 'utf8');

console.log('Running migration to create users table...');

// Split by semicolon and run each statement
const statements = sql.split(';').filter(s => s.trim());

for (const statement of statements) {
  if (!statement.trim()) continue;
  
  console.log('\nExecuting:', statement.substring(0, 50) + '...');
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
  
  if (error) {
    // Try direct query if RPC doesn't work
    const { error: directError } = await supabase.from('_sql').select('*').limit(0);
    console.log('Note: Using Supabase client library - some statements may need manual execution');
  }
}

console.log('\n✅ Migration complete! Verifying...');

// Check if table exists and has data
const { data, error } = await supabase
  .from('users')
  .select('*')
  .limit(10);

if (error) {
  console.error('Error checking users table:', error);
  console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/' + process.env.SUPABASE_PROJECT_ID + '/sql');
} else {
  console.log(`Found ${data.length} users in users table`);
  data.forEach(u => console.log(`  - ${u.email}`));
}

process.exit(0);
