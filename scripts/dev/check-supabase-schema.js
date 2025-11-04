import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Supabase Schema...\n');

// Check all tables in public schema
console.log('📊 Querying information_schema for all tables...\n');

const { data: tables, error: tablesError } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .order('table_name');

if (tablesError) {
  console.error('❌ Error fetching tables:', tablesError.message);
  console.log('\nTrying alternative approach with raw SQL...\n');

  // Try using rpc or direct query
  const { data: allTables, error: rpcError } = await supabase.rpc('get_tables');

  if (rpcError) {
    console.log('Using fallback: listing known tables...\n');

    // Check known tables one by one
    const knownTables = ['users', 'conversations', 'messages', 'documents', 'chunks', 'user_usage'];

    for (const tableName of knownTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          console.log(`✅ Table '${tableName}' exists (${count || 0} rows)`);

          // Get first row to see structure
          const { data: sample } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (sample && sample.length > 0) {
            console.log(`   Columns: ${Object.keys(sample[0]).join(', ')}`);
          }
        } else if (error.message.includes('does not exist') || error.code === 'PGRST204') {
          console.log(`❌ Table '${tableName}' does NOT exist`);
        } else {
          console.log(`⚠️  Table '${tableName}' - Error: ${error.message}`);
        }
      } catch (e) {
        console.log(`⚠️  Table '${tableName}' - Exception: ${e.message}`);
      }
      console.log('');
    }
  }
} else {
  console.log('✅ Found tables in public schema:\n');
  tables.forEach(t => {
    console.log(`  - ${t.table_name}`);
  });
}

console.log('\n🔌 Checking installed extensions...\n');

// Check extensions
try {
  const { data: extensions } = await supabase
    .rpc('get_extensions');

  if (extensions) {
    console.log('Extensions:', extensions);
  }
} catch (e) {
  console.log('Cannot query extensions directly. Common extensions needed:');
  console.log('  - pgvector (for vector embeddings)');
  console.log('  - pg_trgm (for full-text search)');
}

console.log('\n📋 Summary Complete!\n');
process.exit(0);
