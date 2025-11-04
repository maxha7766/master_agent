import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use anon key like frontend does
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_PUBLIC
);

console.log('Testing login with Supabase (same as frontend)...');
console.log('URL:', process.env.SUPABASE_URL);

// Try to login with the user credentials
const testEmail = 'heath.maxwell@gmail.com';
const testPassword = 'testpass123'; // Replace with actual password you used

console.log('\nAttempting login with:', testEmail);

const { data, error } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword
});

if (error) {
  console.error('\n❌ LOGIN FAILED:');
  console.error('Error:', error.message);
  console.error('Status:', error.status);
  console.error('Code:', error.code);
} else {
  console.log('\n✅ LOGIN SUCCESS!');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);
  console.log('Token length:', data.session.access_token.length);
}

process.exit(0);
