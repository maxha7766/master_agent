/**
 * Test the orchestrator's decideSubAgents function
 * This tests if the master orchestrator correctly decides to use RAG
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testDecideSubAgents() {
  console.log('=== TESTING ORCHESTRATOR DECIDE SUB-AGENTS ===\n');

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User ID:', userId);

  // Query available documents (like orchestrator does)
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, file_type, row_count, column_count, chunk_count, summary')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (docsError) {
    console.error('Error querying documents:', docsError);
    return;
  }

  console.log(`\nDocuments found: ${documents.length}`);

  const documentContext = documents
    .map((doc) => {
      if (doc.row_count && doc.row_count > 0) {
        return `- ${doc.file_name} (Tabular: ${doc.row_count} rows, ${doc.column_count} columns)`;
      } else {
        return `- ${doc.file_name} (Text document: ${doc.chunk_count} chunks)`;
      }
    })
    .join('\n');

  console.log('\nDocument context:');
  console.log(documentContext);

  const query = 'tell me about Vito in the Godfather';
  console.log(`\nQuery: "${query}"\n`);

  // Build the system prompt used by orchestrator
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

  const userPrompt = `User Query: "${query}"

Which retrieval system(s) should be used?`;

  try {
    const response = await openai.chat.completions.create({
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('Decision response:', content);

    // Parse JSON
    const parsed = JSON.parse(content);
    console.log('\n=== PARSED DECISION ===');
    console.log('useRAG:', parsed.useRAG);
    console.log('useTabular:', parsed.useTabular);
    console.log('Reasoning:', parsed.reasoning);

    console.log('\n=== DECISION CHECK ===');
    if (parsed.useRAG) {
      console.log('✅ CORRECT: Would use RAG to retrieve context');
    } else {
      console.log('❌ INCORRECT: Would NOT use RAG');
      console.log('This is the problem!');
    }
  } catch (error) {
    console.error('Decision failed:', error);
    console.log('\nNote: If using OpenAI SDK with Claude model name, this will fail.');
    console.log('The orchestrator uses LLMFactory.getProvider which handles this correctly.');
  }
}

testDecideSubAgents().catch(console.error);
