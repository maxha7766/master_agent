import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: users } = await supabase.auth.admin.listUsers();

console.log('User status:');
users.users.forEach(user => {
  console.log('Email:', user.email);
  console.log('Email confirmed:', user.email_confirmed_at ? 'YES' : 'NO');
  console.log('Created:', user.created_at);
  console.log('Last sign in:', user.last_sign_in_at || 'Never');
  console.log('---');
});

// Now let's auto-confirm the user
const userId = users.users[0].id;
console.log('Auto-confirming user email...');

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  email_confirm: true
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('SUCCESS! Email confirmed for', users.users[0].email);
  console.log('You can now log in with this account!');
}

process.exit(0);
