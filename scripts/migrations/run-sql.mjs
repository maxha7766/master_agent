import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

dotenv.config();

// Parse DATABASE_URL
const connectionString = process.env.DATABASE_URL;

const client = new Client({ connectionString });

try {
  await client.connect();
  console.log('Connected to database\n');

  const sql = readFileSync('/Users/heathmaxwell/master_agent/supabase/migrations/20251028000000_add_search_functions.sql', 'utf-8');

  // Execute the SQL
  console.log('Executing migration SQL...\n');
  await client.query(sql);

  console.log('Migration applied successfully!\n');

  // Test the function
  console.log('=== Testing hybrid_search function ===');
  const result = await client.query(
    `SELECT * FROM hybrid_search($1, $2, $3, $4, $5, $6)`,
    [
      JSON.stringify(Array(1536).fill(0.01)),
      'baseball',
      '8f52f05b-47e5-4018-98c2-69e8daf9e5c9',
      3,
      0.7,
      0.3
    ]
  );

  console.log('Results:', result.rows.length);
  console.log('Sample:', result.rows[0]);

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await client.end();
}
