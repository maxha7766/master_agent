/**
 * Check and update user's default chat model
 */

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.nsnqwgbqbaynoayixlqf',
  password: 'Savannah.3122',
  database: 'postgres',
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check current default_chat_model
    const result = await client.query('SELECT user_id, default_chat_model FROM user_settings');

    console.log('Current user settings:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`User ID: ${row.user_id}`);
      console.log(`Default Model: ${row.default_chat_model || 'NULL (will use default)'}`);
      console.log('');
    });

    if (result.rows.length === 0) {
      console.log('No user settings found.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
