import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const projectId = 'omjwoyyhpdawjxsbpamc';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

const sql = readFileSync('/Users/heathmaxwell/master_agent/supabase/migrations/20251028000000_add_search_functions.sql', 'utf-8');

console.log('Applying SQL functions via Supabase Management API...\n');

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectId}/database/query`,
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
  console.error('Error:', result);
} else {
  console.log('Success:', result);
}

// Alternative: Use Supabase client with direct query execution
console.log('\n\n=== Alternative: Using Supabase Client ===\n');

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: {
      schema: 'public'
    }
  }
);

// Split into individual function creates
const functions = sql.split(/(?=CREATE OR REPLACE FUNCTION)/g).filter(s => s.trim() && s.includes('FUNCTION'));

for (let i = 0; i < functions.length; i++) {
  const funcSQL = functions[i].trim();
  const funcName = funcSQL.match(/FUNCTION\s+(\w+)/)?.[1] || `function_${i}`;

  console.log(`Creating ${funcName}...`);

  // Use a workaround: create via REST API query param
  const { data, error } = await supabase.rpc('exec_sql', { sql: funcSQL }).catch(() => ({ data: null, error: 'rpc not available' }));

  if (error) {
    console.log(`  Skipping RPC method (${error})`);
  } else {
    console.log(`  Created via RPC`);
  }
}

console.log('\nDone!');
