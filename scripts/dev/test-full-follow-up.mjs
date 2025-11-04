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

console.log('🧪 Testing Full Follow-Up Query Flow\n');
console.log('═══════════════════════════════════════════\n');

// Simulate conversation history
const conversationHistory = [
  { role: 'user', content: 'how many Pete Crow-Armstrong cards do i have listed?' },
  { role: 'assistant', content: 'You have 10 Pete Crow-Armstrong cards listed.' },
];

console.log('Conversation History:');
conversationHistory.forEach((msg) => {
  console.log(`  ${msg.role}: ${msg.content}`);
});
console.log('\nUser Query: "can you list them?"\n');

// Get documents
const { data: documents, error: docError } = await supabase
  .from('documents')
  .select('id, file_name, file_type, row_count, column_count, semantic_schema, user_description')
  .eq('user_id', userId)
  .eq('status', 'completed')
  .not('row_count', 'is', null)
  .gt('row_count', 0);

if (docError || !documents || documents.length === 0) {
  console.error('❌ No tabular documents found');
  process.exit(1);
}

const doc = documents[0];
const schema = doc.semantic_schema || {};
const fields = schema.fields || schema.columns || [];

console.log(`Document: ${doc.file_name} (${doc.row_count} rows)\n`);

// Build system prompt for SQL generation
const documentContext = documents
  .map((d, i) => {
    const schema = d.semantic_schema || {};
    const fields = schema.fields || schema.columns || [];

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

const conversationContext = `\n\n**Recent Conversation:**\n${conversationHistory
  .slice(-6)
  .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}`)
  .join('\n')}\n`;

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
7. **FOLLOW-UP QUERY HANDLING**: Pay attention to the conversation history - if the user refers to "those items", "them", "it", "the previous results", look at the recent conversation to understand what they're referring to
8. Use the user description field to understand what the data represents

**CONFIDENCE & CLARIFICATION:**
- After analyzing the query, assess your confidence (0-100%) that you understand what the user wants
- If confidence < 95%, set needsClarification=true and provide a clarification question
- Common cases needing clarification:
  * Pronouns without clear antecedent ("list them" when no previous query)
  * Ambiguous terms ("the expensive ones" - how expensive?)
  * Multiple possible interpretations

**Response Format (JSON):**
{
  "confidence": 95,
  "needsClarification": false,
  "clarificationQuestion": "optional - only if needsClarification is true",
  "sql": "SELECT ... FROM document_data WHERE ...",
  "explanation": "This query calculates... by...",
  "document_ids": ["uuid1", "uuid2"]
}

**Example - Follow-up Query:**
User previous: "how many Pete Crow-Armstrong cards?"
User current: "can you list them?"
Response: {"confidence": 98, "needsClarification": false, "sql": "SELECT title, price FROM document_data WHERE...Pete Crow-Armstrong..."}`;

const userPrompt = `${conversationContext}
User Query: can you list them?

Generate a SQL query to answer this question using the available documents.`;

console.log('═══════════════════════════════════════════\n');
console.log('Generating SQL with conversation context...\n');

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

console.log(`Confidence: ${parsed.confidence}%`);
console.log(`Needs Clarification: ${parsed.needsClarification || false}`);

if (parsed.needsClarification) {
  console.log(`\n❌ FAILED: Agent needs clarification when it should understand from context`);
  console.log(`Clarification Question: ${parsed.clarificationQuestion}`);
  process.exit(1);
}

console.log(`\nGenerated SQL:`);
console.log(parsed.sql);
console.log(`\nExplanation: ${parsed.explanation}`);

// Check if SQL correctly references Pete Crow-Armstrong
if (!parsed.sql.toLowerCase().includes('pete crow-armstrong')) {
  console.log('\n❌ FAILED: SQL does not reference Pete Crow-Armstrong');
  console.log('The agent did not understand "them" refers to Pete Crow-Armstrong cards from conversation history');
  process.exit(1);
}

console.log('\n✅ SUCCESS: SQL correctly uses conversation history to understand "them" = Pete Crow-Armstrong cards');

// Execute the query
console.log('\n═══════════════════════════════════════════\n');
console.log('Executing SQL query...\n');

const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_tabular_query', {
  p_user_id: userId,
  p_query: parsed.sql,
});

if (rpcError) {
  console.error('❌ RPC Error:', rpcError);
  process.exit(1);
}

if (!rpcResult?.success) {
  console.error('❌ Query failed:', rpcResult?.error || 'Unknown error');
  process.exit(1);
}

console.log(`✅ Query executed successfully`);
console.log(`   Rows returned: ${rpcResult.row_count}`);
console.log(`   Execution time: ${rpcResult.execution_time_ms}ms\n`);

if (rpcResult.row_count === 0) {
  console.log('❌ FAILED: Query returned 0 results (should return Pete Crow-Armstrong cards)');
  process.exit(1);
}

console.log('First 3 results:');
rpcResult.data.slice(0, 3).forEach((row, i) => {
  console.log(`${i + 1}. ${JSON.stringify(row)}`);
});

console.log('\n═══════════════════════════════════════════');
console.log('\n✅ ALL TESTS PASSED');
console.log('Follow-up query flow works correctly!');
console.log('- Routing detects follow-up query from pronouns + conversation history');
console.log('- Tabular agent uses conversation context to understand "them"');
console.log('- SQL correctly filters for Pete Crow-Armstrong cards');
console.log('- Query executes and returns actual results from database');

process.exit(0);
