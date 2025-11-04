import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log('=== CHECKING ALL USERS ===\n');

  // Get all users from auth
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  console.log(`Total users: ${users.length}\n`);

  for (const user of users) {
    console.log(`User ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Created: ${user.created_at}`);

    // Check documents for this user
    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, chunk_count')
      .eq('user_id', user.id);

    const docCount = docs ? docs.length : 0;
    console.log(`Documents: ${docCount}`);

    if (docs && docs.length > 0) {
      docs.forEach(d => {
        const chunks = d.chunk_count || 0;
        console.log(`  - ${d.file_name} (${chunks} chunks)`);
      });
    }

    console.log('');
  }

  console.log('\n=== RECOMMENDATION ===');
  console.log('The frontend user needs to match the document owner.');
  console.log('Options:');
  console.log('1. Log in to the frontend with the email that owns the documents');
  console.log('2. Transfer documents to the current frontend user');
}

checkUsers().catch(console.error);
