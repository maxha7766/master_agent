import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_PUBLIC
);

console.log('Testing login...');

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'heath.maxwell@gmail.com',
  password: 'Password123'
});

if (error) {
  console.error('❌ LOGIN FAILED:', error.message);
} else {
  console.log('✅ LOGIN SUCCESS!');
  console.log('User:', data.user.email);
}

process.exit(0);
