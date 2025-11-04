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

console.log('🧪 Testing Follow-Up Query Detection\n');
console.log('═══════════════════════════════════════════\n');

// Step 1: Get tabular documents
console.log('Step 1: Fetching tabular documents...');
const { data: documents, error: docError } = await supabase
  .from('documents')
  .select('id, file_name, file_type, row_count, column_count')
  .eq('user_id', userId)
  .eq('status', 'completed')
  .not('row_count', 'is', null)
  .gt('row_count', 0);

if (docError || !documents || documents.length === 0) {
  console.error('❌ No tabular documents found');
  process.exit(1);
}

console.log(`✅ Found ${documents.length} tabular document(s)\n`);

const documentContext = documents
  .map((doc) => `- ${doc.file_name} (Tabular: ${doc.row_count} rows, ${doc.column_count} columns)`)
  .join('\n');

// Step 2: Simulate conversation history
const conversationHistory = [
  { role: 'user', content: 'how many Pete Crow-Armstrong cards do i have listed?' },
  { role: 'assistant', content: 'You have 10 Pete Crow-Armstrong cards listed.' },
];

console.log('Step 2: Simulating conversation history...');
console.log('Previous messages:');
conversationHistory.forEach((msg) => {
  console.log(`  ${msg.role}: ${msg.content}`);
});
console.log();

// Step 3: Test routing decision for follow-up query
console.log('Step 3: Testing routing decision for "can you list them?"...\n');

const conversationContext = `\n\n**Recent Conversation:**\n${conversationHistory
  .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}`)
  .join('\n')}\n`;

const systemPrompt = `You are a routing agent. Analyze the user's query and available documents to decide which retrieval systems to use.

**Available Documents:**
${documentContext}

**Retrieval Systems:**
- RAG: For searching text documents (PDFs, documents) using semantic search
- Tabular: For querying CSV/Excel data using SQL

**Your Task:**
Decide which system(s) to use. You can use both if needed.

**CRITICAL RULES FOR FOLLOW-UP QUERIES:**
- If the user's query contains pronouns like "them", "it", "those", "that", or phrases like "list them", "show me those", etc., check the conversation history
- If recent conversation involved tabular data (counts, queries, listings), you MUST route to Tabular even if the current query seems vague
- The Tabular system has its own clarification logic - it will ask for clarification if needed
- Better to route an ambiguous follow-up query to Tabular and let IT handle clarification than to block it entirely

**Examples:**
- User previous: "how many Pete Crow-Armstrong cards?" → Current: "can you list them?" → USE TABULAR (follow-up about cards)
- User previous: "what are the highest prices?" → Current: "show me the top 10" → USE TABULAR (follow-up about prices)
- User: "tell me about AI" → USE RAG (if text docs) or neither (if only tabular docs)

**Response Format (JSON):**
{
  "useRAG": true/false,
  "useTabular": true/false,
  "reasoning": "Brief explanation"
}`;

const userPrompt = `${conversationContext}
User Query: "can you list them?"

Which retrieval system(s) should be used?`;

console.log('Sending to Claude for routing decision...\n');

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  temperature: 0.1,
  messages: [
    { role: 'user', content: systemPrompt + '\n\n' + userPrompt },
  ],
});

const responseText = response.content[0].text;
console.log('Claude Response:');
console.log(responseText);
console.log();

try {
  const decision = JSON.parse(responseText);

  console.log('═══════════════════════════════════════════\n');
  console.log('Routing Decision:');
  console.log(`  useRAG: ${decision.useRAG}`);
  console.log(`  useTabular: ${decision.useTabular}`);
  console.log(`  reasoning: ${decision.reasoning}`);
  console.log();

  if (decision.useTabular) {
    console.log('✅ SUCCESS: Follow-up query correctly routed to Tabular agent!');
    console.log('The tabular agent will now use conversation history to understand "them" refers to Pete Crow-Armstrong cards.');
  } else {
    console.log('❌ FAILED: Follow-up query NOT routed to Tabular agent');
    console.log('This means the fix did not work as expected.');
  }
} catch (e) {
  console.error('❌ Failed to parse JSON response:', e.message);
  console.log('Full response:', responseText);
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════');
process.exit(0);
