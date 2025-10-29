import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync('/Users/heathmaxwell/master_agent/supabase/migrations/20251028000000_add_search_functions.sql', 'utf-8');

console.log('Applying migration...\n');

// Execute the entire SQL as one block
const { data, error } = await supabase.rpc('exec_sql', { sql });

if (error) {
  // Try alternative method: use raw SQL
  console.log('exec_sql not available, using direct queries...\n');

  // Split by CREATE OR REPLACE FUNCTION
  const functions = sql.split('CREATE OR REPLACE FUNCTION').filter(s => s.trim());

  for (let i = 0; i < functions.length; i++) {
    if (i > 0) { // Skip first empty split
      const funcDef = 'CREATE OR REPLACE FUNCTION' + functions[i];
      console.log(`Creating function ${i}...`);

      // Use query instead
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: funcDef })
      });

      console.log('Response:', response.status);
    }
  }
} else {
  console.log('Migration applied successfully!');
}

// Test if functions exist
console.log('\n=== Testing hybrid_search function ===');
const { data: testData, error: testError } = await supabase.rpc('hybrid_search', {
  query_embedding: JSON.stringify(Array(1536).fill(0.01)),
  query_text: 'baseball',
  match_user_id: '8f52f05b-47e5-4018-98c2-69e8daf9e5c9',
  match_count: 3,
  vector_weight: 0.7,
  keyword_weight: 0.3
});

if (testError) {
  console.log('Error testing function:', testError);
} else {
  console.log('Function works! Results:', testData?.length || 0);
}
