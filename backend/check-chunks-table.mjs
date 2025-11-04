#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('Checking chunks table...\n');

// Try different table name
const { data: chunks, error } = await supabase
  .from('chunks')
  .select('id, document_id, user_id', { count: 'exact' })
  .limit(5);

if (error) {
  console.log('❌ Error with "chunks" table:', error.message);
} else {
  console.log('✅ "chunks" table exists!');
  console.log(`   Total chunks: ${chunks.length}`);
  if (chunks.length > 0) {
    console.log('   Sample:', chunks[0]);
  }
}

// Check user settings
console.log('\nChecking user_settings table...\n');
const { data: settings, error: settingsError } = await supabase
  .from('user_settings')
  .select('*')
  .limit(1);

if (settingsError) {
  console.log('❌ Error with user_settings:', settingsError.message);
} else {
  console.log('✅ user_settings table exists!');
  if (settings.length > 0) {
    console.log('   Columns:', Object.keys(settings[0]));
  }
}

// Check documents with chunk_count
console.log('\nChecking documents...\n');
const { data: docs, error: docsError } = await supabase
  .from('documents')
  .select('id, title, chunk_count')
  .gt('chunk_count', 0)
  .limit(5);

if (docsError) {
  console.log('❌ Error:', docsError.message);
} else {
  console.log('✅ Documents with chunks:');
  docs.forEach(doc => {
    console.log(`   ${doc.title}: ${doc.chunk_count} chunks`);
  });
}
