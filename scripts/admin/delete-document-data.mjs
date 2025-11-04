import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteDocumentData() {
  console.log('Deleting all document_data rows...\n');

  const { error } = await supabase
    .from('document_data')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ All document_data deleted');

    // Verify
    const { count } = await supabase
      .from('document_data')
      .select('*', { count: 'exact', head: true });

    console.log('Remaining rows:', count || 0);
  }
}

deleteDocumentData().catch(console.error);
