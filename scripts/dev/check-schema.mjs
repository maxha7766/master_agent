import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

// Query the information schema to see actual columns
const { data, error } = await supabase
  .rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'documents'
      ORDER BY ordinal_position;
    `
  });

if (error) {
  console.error('Error querying schema:', error);
  console.log('\nTrying direct query instead...');

  // Try getting one document to see what fields exist
  const { data: docs, error: docError } = await supabase
    .from('documents')
    .select('*')
    .limit(0);

  if (docError) {
    console.error('Doc error:', docError);
  }
} else {
  console.log('Documents table schema:');
  console.table(data);
}
