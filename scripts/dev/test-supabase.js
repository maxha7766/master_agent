import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing Supabase connection...');
console.log('URL:', process.env.SUPABASE_URL);

const { data: users, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error('Error listing users:', error);
} else {
  console.log('Found ' + users.users.length + ' users in Supabase:');
  users.users.forEach(user => {
    console.log('  - ' + user.email + ' (ID: ' + user.id + ')');
  });
}

const { data: convos, error: convoError } = await supabase
  .from('conversations')
  .select('*')
  .limit(5);

if (convoError) {
  console.error('Error accessing conversations:', convoError);
} else {
  const count = convos ? convos.length : 0;
  console.log('Found ' + count + ' conversations');
}

process.exit(0);
