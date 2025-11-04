import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey || !anthropicKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('🧪 Testing Tabular Agent End-to-End\n');
console.log('═══════════════════════════════════════════\n');

// Step 1: Get tabular documents
console.log('Step 1: Fetching tabular documents...');
const { data: documents, error: docError } = await supabase
  .from('documents')
  .select('id, file_name, file_type, row_count, column_count, semantic_schema, user_description')
  .eq('user_id', userId)
  .eq('status', 'completed')
  .not('row_count', 'is', null)
  .gt('row_count', 0)
  .order('created_at', { ascending: false });

if (docError) {
  console.error('❌ Failed to fetch documents:', docError);
  process.exit(1);
}

console.log(`✅ Found ${documents.length} tabular document(s)\n`);

if (documents.length === 0) {
  console.log('❌ No tabular documents found');
  process.exit(1);
}

const doc = documents[0];
const schema = doc.semantic_schema || {};
const fields = schema.fields || schema.columns || [];

console.log(`Document: ${doc.file_name}`);
console.log(`  ID: ${doc.id}`);
console.log(`  Description: ${doc.user_description || 'None'}`);
console.log(`  Rows: ${doc.row_count}, Columns: ${doc.column_count}`);
console.log(`  Schema fields: ${fields.length}`);

if (fields.length > 0) {
  console.log('\n  Schema:');
  fields.slice(0, 5).forEach((f) => {
    console.log(`    - ${f.name} (${f.inferred_type}): ${f.description || 'No description'}`);
  });
  if (fields.length > 5) {
    console.log(`    ... and ${fields.length - 5} more fields`);
  }
}

console.log('\n═══════════════════════════════════════════\n');

// Step 2: Generate SQL query
console.log('Step 2: Generating SQL query with Claude...');

const documentContext = documents
  .map((d, i) => {
    const schema = d.semantic_schema || {};
    const fields = schema.fields || [];

    return `
### Document ${i + 1}: ${d.file_name}
- Document ID: ${d.id}
- Rows: ${d.row_count}, Columns: ${d.column_count}
- Description: ${d.user_description || 'No description'}
- Schema:
${fields.map((f) => `  * ${f.name} (${f.inferred_type}): ${f.description || 'No description'}`).join('\n')}
`;
  })
  .join('\n');

const systemPrompt = `You are a SQL query generator for JSONB data stored in PostgreSQL.

**Available Documents:**
${documentContext}

**Database Schema:**
- Table: \`document_data\`
- Columns:
  * \`id\` (UUID): Unique row identifier
  * \`document_id\` (UUID): References the document this row belongs to
  * \`row_data\` (JSONB): The actual data row with all fields
  * \`row_index\` (INTEGER): Original row number from CSV/Excel
  * \`document_metadata\` (JSONB): Contains document_id, file_name, user_description
  * \`created_at\` (TIMESTAMP): When the row was inserted

**Your Task:**
Generate a PostgreSQL query that answers the user's question using the JSONB data.

**JSONB Query Syntax:**
- Access fields: \`row_data->>'field_name'\` (returns text)
- Access nested: \`row_data->'field'->'subfield'\`
- Cast types: \`(row_data->>'amount')::numeric\`
- Array contains: \`row_data @> '{"status": "active"}'\`
- Filter by document: \`document_id = 'uuid-here'\`

**CRITICAL RULES:**
1. **USE EXACT COLUMN NAMES**: You MUST use the EXACT field names from the schema above. For example, if the schema shows "Current price", use \`row_data->>'Current price'\`, NOT \`row_data->>'price'\`. Match the casing and spacing exactly.
2. Always filter by \`document_id\` if querying specific document(s)
3. Cast numeric fields when doing math: \`(row_data->>'amount')::numeric\`
4. Use appropriate SQL functions (SUM, AVG, COUNT, GROUP BY, ORDER BY)
5. Limit results to reasonable numbers (add LIMIT clause)
6. Return meaningful column names using AS aliases
7. Pay attention to the conversation history - if the user refers to "those items" or "the previous results", use context from earlier messages
8. Use the user description field to understand what the data represents

**Response Format (JSON):**
{
  "sql": "SELECT ... FROM document_data WHERE ...",
  "explanation": "This query calculates... by...",
  "document_ids": ["uuid1", "uuid2"]
}`;

const userQuery = 'what are the five highest price listings?';
const userPrompt = `User Query: ${userQuery}

Generate a SQL query to answer this question using the available documents.`;

console.log(`Query: "${userQuery}"\n`);

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2000,
  temperature: 0.1,
  messages: [
    { role: 'user', content: systemPrompt + '\n\n' + userPrompt },
    {
      role: 'user',
      content:
        'CRITICAL: You MUST respond with ONLY valid JSON in the format specified above. Do NOT write natural language explanations. Start your response with { and end with }',
    },
  ],
});

const responseText = response.content[0].text;
console.log('Claude Response (first 200 chars):');
console.log(responseText.substring(0, 200) + '...\n');

// Parse JSON
let parsed;
try {
  parsed = JSON.parse(responseText);
  console.log('✅ Valid JSON response\n');
} catch (e) {
  console.error('❌ Failed to parse JSON:', e.message);
  console.log('\nFull response:');
  console.log(responseText);
  process.exit(1);
}

console.log('Generated SQL:');
console.log(parsed.sql);
console.log('\nExplanation:', parsed.explanation);
console.log('Document IDs:', parsed.document_ids);

// Check if SQL uses correct column name
if (parsed.sql.includes("row_data->>'price'") && !parsed.sql.includes("row_data->>'Current price'")) {
  console.log('\n⚠️  WARNING: SQL uses shortened column name "price" instead of "Current price"');
}

console.log('\n═══════════════════════════════════════════\n');

// Step 3: Execute SQL via RPC
console.log('Step 3: Executing SQL via RPC...');

const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_tabular_query', {
  p_user_id: userId,
  p_query: parsed.sql,
});

if (rpcError) {
  console.error('❌ RPC Error:', rpcError);
  process.exit(1);
}

console.log('\nRPC Response Structure:');
console.log(`  Type: ${typeof rpcResult}`);
console.log(`  Keys: ${rpcResult ? Object.keys(rpcResult).join(', ') : 'none'}`);
console.log(`  Success: ${rpcResult?.success}`);
console.log(`  Row Count: ${rpcResult?.row_count}`);
console.log(`  Execution Time: ${rpcResult?.execution_time_ms}ms`);

if (!rpcResult?.success) {
  console.error('❌ Query failed:', rpcResult?.error || 'Unknown error');
  process.exit(1);
}

console.log('\n✅ Query executed successfully\n');

// Step 4: Display results
console.log('═══════════════════════════════════════════\n');
console.log('Step 4: Results\n');

const results = rpcResult.data || [];

if (results.length === 0) {
  console.log('❌ NO RESULTS RETURNED\n');
  console.log('This means either:');
  console.log('  1. The SQL query is using wrong column names');
  console.log('  2. The data does not exist in document_data table');
  console.log('  3. The WHERE clause is filtering out all rows');
} else {
  console.log(`✅ Found ${results.length} results:\n`);
  results.forEach((row, i) => {
    console.log(`${i + 1}. ${JSON.stringify(row)}`);
  });
}

console.log('\n═══════════════════════════════════════════\n');
console.log('Test Complete');
process.exit(0);
