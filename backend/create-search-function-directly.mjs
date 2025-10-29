/**
 * Create the hybrid_search function directly using Management API or SQL
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Read the SQL
const sql = readFileSync('/Users/heathmaxwell/master_agent/supabase/migrations/20251028000000_add_search_functions.sql', 'utf-8');

console.log('=== Creating Search Functions ===\n');
console.log('SQL content (first 500 chars):');
console.log(sql.substring(0, 500));
console.log('...\n');

// Try using Supabase Management API to execute SQL
const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.log('No SUPABASE_ACCESS_TOKEN found. Using alternative method...\n');
} else {
  console.log(`Executing via Management API for project: ${projectRef}\n`);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: sql
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('API Error:', result);
    } else {
      console.log('Functions created successfully via API!');
    }
  } catch (error) {
    console.error('Error calling Management API:', error.message);
  }
}

// Test if it works now
console.log('\n=== Testing Functions ===\n');

const testEmbedding = Array(1536).fill(0.01);
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

const { data, error } = await supabase.rpc('hybrid_search', {
  query_embedding: JSON.stringify(testEmbedding),
  query_text: 'baseball',
  match_user_id: userId,
  match_count: 5,
  vector_weight: 0.7,
  keyword_weight: 0.3
});

if (error) {
  console.log('Error:', error);
} else {
  console.log(`Results: ${data?.length || 0}`);
  if (data && data.length > 0) {
    console.log('First result:', {
      chunk_id: data[0].chunk_id,
      content_preview: data[0].content?.substring(0, 100),
      relevance_score: data[0].relevance_score
    });
  }
}
