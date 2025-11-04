import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Resetting password for heath.maxwell@gmail.com...');

const { data: users } = await supabase.auth.admin.listUsers();
const user = users.users.find(u => u.email === 'heath.maxwell@gmail.com');

if (!user) {
  console.error('User not found!');
  process.exit(1);
}

console.log('Found user:', user.id);

// Update password
const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
  password: 'Password123'
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Password reset successfully!');
  console.log('You can now login with:');
  console.log('  Email: heath.maxwell@gmail.com');
  console.log('  Password: Password123');
}

process.exit(0);
