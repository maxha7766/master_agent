/**
 * SQL Agent Test Script
 * Tests adding a database connection and querying
 */

import 'dotenv/config';
import { encryptConnectionString, decryptConnectionString, validateConnectionString } from './dist/services/database/encryption.js';
import { supabase } from './dist/models/database.js';

// Test user ID (you'll need to replace this with a real user ID from your auth.users table)
const TEST_USER_ID = 'your-user-id-here'; // TODO: Replace with actual user ID

// Test database connection string
// Using the Supabase database itself as a test (you can query the public schema)
const TEST_CONNECTION_STRING = process.env.SUPABASE_URL
  ? `postgresql://postgres:${process.env.SUPABASE_PROJECT_PASSWORD}@db.${process.env.SUPABASE_PROJECT_ID}.supabase.co:5432/postgres`
  : 'postgresql://localhost:5432/test';

async function testSQLAgent() {
  console.log('🧪 SQL Agent Test\n');

  try {
    // Step 1: Validate connection string
    console.log('1️⃣  Validating connection string...');
    validateConnectionString(TEST_CONNECTION_STRING);
    console.log('✅ Connection string is valid\n');

    // Step 2: Test encryption/decryption
    console.log('2️⃣  Testing encryption...');
    const encrypted = encryptConnectionString(TEST_CONNECTION_STRING);
    console.log(`✅ Encrypted: ${encrypted.substring(0, 50)}...\n`);

    console.log('3️⃣  Testing decryption...');
    const decrypted = decryptConnectionString(encrypted);
    const matches = decrypted === TEST_CONNECTION_STRING;
    console.log(`✅ Decrypted matches original: ${matches}\n`);

    if (!matches) {
      throw new Error('Encryption/decryption test failed!');
    }

    // Step 3: Add database connection
    console.log('4️⃣  Adding database connection to Supabase...');

    // First, get a real user ID from the database
    console.log('   Fetching first user from auth.users...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.log('⚠️  No users found. Creating a test user would require auth setup.');
      console.log('   You can manually insert a database connection using this SQL:');
      console.log(`
INSERT INTO database_connections (user_id, name, encrypted_connection_string, active)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Test Database',
  '${encrypted}',
  true
);
      `);
      return;
    }

    const userId = users[0].id;
    console.log(`   Using user ID: ${userId}\n`);

    // Check if connection already exists
    const { data: existing } = await supabase
      .from('database_connections')
      .select('id, name')
      .eq('user_id', userId)
      .eq('name', 'Test Database')
      .single();

    if (existing) {
      console.log(`✅ Test connection already exists: ${existing.id}\n`);
      console.log('🎉 SQL Agent is ready to use!');
      console.log('\nYou can now:');
      console.log('1. Open your chat interface');
      console.log('2. Ask questions like "How many tables are in the database?"');
      console.log('3. Or "Show me the first 5 rows from the documents table"');
      return;
    }

    // Insert new connection
    const { data: connection, error: insertError } = await supabase
      .from('database_connections')
      .insert({
        user_id: userId,
        name: 'Test Database',
        encrypted_connection_string: encrypted,
        active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert connection: ${insertError.message}`);
    }

    console.log('✅ Database connection added successfully!');
    console.log(`   ID: ${connection.id}`);
    console.log(`   Name: ${connection.name}\n`);

    console.log('🎉 SQL Agent setup complete!\n');
    console.log('Next steps:');
    console.log('1. Start your backend server: npm run dev');
    console.log('2. Open your chat interface');
    console.log('3. Ask SQL questions like:');
    console.log('   - "How many tables are in my database?"');
    console.log('   - "Show me the schema for the documents table"');
    console.log('   - "List the first 10 users"');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Check for DB_ENCRYPTION_KEY
if (!process.env.DB_ENCRYPTION_KEY) {
  console.error('❌ DB_ENCRYPTION_KEY environment variable is not set!');
  console.error('Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"');
  process.exit(1);
}

testSQLAgent();
