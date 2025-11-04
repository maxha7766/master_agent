/**
 * Drop existing hybrid_search functions and recreate properly
 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log('=== Fixing Search Functions ===\n');

// Step 1: Drop all hybrid_search functions
console.log('Step 1: Dropping existing functions...\n');

const dropSQL = `
-- Drop all versions of hybrid_search
DROP FUNCTION IF EXISTS hybrid_search(TEXT, TEXT, UUID, INTEGER, FLOAT, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS hybrid_search CASCADE;

-- Drop all versions of search_document
DROP FUNCTION IF EXISTS search_document(TEXT, UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS search_document CASCADE;
`;

try {
  const dropResponse = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: dropSQL
      })
    }
  );

  const dropResult = await dropResponse.json();

  if (!dropResponse.ok) {
    console.error('Drop error:', dropResult);
  } else {
    console.log('Existing functions dropped successfully\n');
  }
} catch (error) {
  console.error('Error dropping functions:', error.message);
}

// Step 2: Create new functions
console.log('Step 2: Creating functions...\n');

const createSQL = readFileSync('/Users/heathmaxwell/master_agent/supabase/migrations/20251028000000_add_search_functions.sql', 'utf-8');

try {
  const createResponse = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: createSQL
      })
    }
  );

  const createResult = await createResponse.json();

  if (!createResponse.ok) {
    console.error('Create error:', createResult);
  } else {
    console.log('Functions created successfully!\n');
  }
} catch (error) {
  console.error('Error creating functions:', error.message);
}

// Step 3: Test
console.log('Step 3: Testing...\n');

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  console.log(`✓ hybrid_search works! Found ${data?.length || 0} results`);
  if (data && data.length > 0) {
    console.log('\nFirst result:');
    console.log(`  Chunk ID: ${data[0].chunk_id}`);
    console.log(`  Content: ${data[0].content?.substring(0, 150)}...`);
    console.log(`  Relevance Score: ${data[0].relevance_score}`);
  }
}

console.log('\n=== Done ===');
