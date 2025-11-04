/**
 * Test intent classification for "tell me about Vito in the Godfather"
 * This tests if the intent classifier is routing correctly
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

const CLASSIFICATION_PROMPT = `You are an intent classifier for a personal AI assistant with multiple specialized capabilities.

The user has uploaded documents to their personal knowledge base. IMPORTANT: Any question that could potentially be answered from uploaded documents should be classified as "rag_query" to search their documents first.

Classify the user's message into ONE of these categories:

1. **general_chat**: Casual conversation, greetings, general questions about the AI assistant's capabilities
   Examples: "Hello", "How are you?", "What can you help me with?", "Tell me a joke"

2. **rag_query**: ANY question that could be answered from uploaded documents - definitions, explanations, summaries, facts, rules, procedures, etc.
   Examples:
   - "What does my contract say about termination?"
   - "Summarize the main findings in my research paper"
   - "Find mentions of X in my documents"
   - "What is a balk?" (if user has sports/rules documents)
   - "Define term X" (if user might have reference documents)
   - "Explain concept Y" (if user has educational/technical documents)
   - "What are the rules for Z?" (if user has policy/rules documents)

3. **sql_query**: Questions EXPLICITLY about EXTERNAL connected databases (PostgreSQL, MySQL, etc.)
   Examples: "Query my production database for users", "Connect to my MySQL database and show tables"

   NOTE: Questions about uploaded CSV/Excel files should be classified as "rag_query", NOT "sql_query"

4. **research_request**: Questions EXPLICITLY requesting web search, news, or current events that are clearly outside uploaded documents
   Examples:
   - "What's the latest news on AI?" (current events)
   - "Search the web for company X's recent announcements" (explicitly web search)
   - "What happened today in politics?" (current events)

5. **multi_step_workflow**: Complex requests requiring multiple steps or agent coordination
   Examples: "Research company X online, then find their financial reports in my documents, and analyze their revenue trends", "Search my documents for contracts, extract key terms, and create a summary report"

IMPORTANT DECISION RULES:
- If the user has documents uploaded, DEFAULT to "rag_query" for ANY informational question (definitions, explanations, facts, etc.)
- Only use "research_request" if the question EXPLICITLY mentions current events, news, or web search
- When in doubt between rag_query and research_request, choose rag_query

Respond in JSON format:
{
  "intent": "category_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

async function testIntentClassification() {
  console.log('=== TESTING INTENT CLASSIFICATION ===\n');

  const query = 'tell me about Vito in the Godfather';
  console.log(`Query: "${query}"\n`);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.0,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('Classification response:', content);

    // Parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n=== PARSED CLASSIFICATION ===');
      console.log('Intent:', parsed.intent);
      console.log('Confidence:', parsed.confidence);
      console.log('Reasoning:', parsed.reasoning);

      // Check if it would route to RAG
      console.log('\n=== ROUTING CHECK ===');
      if (parsed.intent === 'rag_query') {
        console.log('✅ CORRECT: Would route to RAG agent');
      } else {
        console.log(`❌ INCORRECT: Would route to ${parsed.intent} instead of rag_query`);
        console.log('This is likely the problem!');
      }
    }
  } catch (error) {
    console.error('Classification failed:', error);
  }
}

testIntentClassification().catch(console.error);
