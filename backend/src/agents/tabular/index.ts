/**
 * Tabular Query Agent
 * Handles natural language queries over CSV/Excel data stored as JSONB
 */

import { supabase } from '../../models/database.js';
import { LLMFactory } from '../../services/llm/factory.js';
import { log } from '../../lib/logger.js';

export interface TabularDocument {
  id: string;
  file_name: string;
  file_type: string;
  row_count: number;
  column_count: number;
  semantic_schema: any;
  user_description?: string;
}

/**
 * Check if user has any tabular documents
 */
export async function hasTabularDocuments(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('row_count', 'is', null)
      .gt('row_count', 0);

    if (error) {
      log.error('Failed to check for tabular documents', { userId, error });
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    log.error('Error checking tabular documents', { userId, error });
    return false;
  }
}

/**
 * Get user's tabular documents with schemas
 */
export async function getTabularDocuments(userId: string): Promise<TabularDocument[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, row_count, column_count, semantic_schema, user_description')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('row_count', 'is', null)
      .gt('row_count', 0)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch tabular documents', { userId, error });
      return [];
    }

    return data || [];
  } catch (error) {
    log.error('Error fetching tabular documents', { userId, error });
    return [];
  }
}

/**
 * Generate SQL query from natural language
 */
export async function generateSQLQuery(
  userQuery: string,
  documents: TabularDocument[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<{ sql: string; explanation: string; documentIds: string[]; needsClarification?: boolean; clarificationQuestion?: string }> {
  try {
    const provider = LLMFactory.getProvider(model);

    // Build context about available documents and schemas
    const documentContext = documents.map((doc, i) => {
      const schema = doc.semantic_schema || {};
      // Support both 'fields' and 'columns' for schema structure
      const fields = schema.fields || schema.columns || [];

      return `
### Document ${i + 1}: ${doc.file_name}
- Document ID: ${doc.id}
- Rows: ${doc.row_count}, Columns: ${doc.column_count}
- Description: ${doc.user_description || 'No description'}
- Schema:
${fields.map((f: any) => `  * ${f.name} (${f.inferred_type}): ${f.description || 'No description'}`).join('\n')}
`;
    }).join('\n');

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

**Example - High Confidence:**
User: "how many Pete Crow-Armstrong cards?"
Response: {"confidence": 100, "needsClarification": false, "sql": "SELECT COUNT(*)..."}

**Example - Needs Clarification:**
User: "can you list them?"
Conversation: []
Response: {"confidence": 30, "needsClarification": true, "clarificationQuestion": "What would you like me to list? Please specify which items you're interested in."}

**Example - Follow-up Query:**
User previous: "how many Pete Crow-Armstrong cards?"
User current: "can you list them?"
Response: {"confidence": 98, "needsClarification": false, "sql": "SELECT title, price FROM document_data WHERE...Pete Crow-Armstrong..."}`;

    // Build conversation context for SQL generation
    const conversationContext = conversationHistory.length > 0
      ? `\n\n**Recent Conversation:**\n${conversationHistory
          .slice(-6) // Last 3 exchanges
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}`)
          .join('\n')}\n`
      : '';

    const userPrompt = `${conversationContext}
User Query: ${userQuery}

Generate a SQL query to answer this question using the available documents.`;

    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        {
          role: 'user',
          content:
            'CRITICAL: You MUST respond with ONLY valid JSON in the format specified above. Do NOT write natural language explanations. Start your response with { and end with }',
        },
      ],
      model,
      { temperature: 0.1 }
    );

    // Parse JSON response
    const parsed = JSON.parse(response.content);

    // Check if clarification is needed
    if (parsed.needsClarification) {
      log.info('SQL generation needs clarification', {
        userQuery,
        confidence: parsed.confidence,
        clarificationQuestion: parsed.clarificationQuestion,
      });

      return {
        sql: '', // Empty SQL since we need clarification
        explanation: parsed.explanation || '',
        documentIds: parsed.document_ids || [],
        needsClarification: true,
        clarificationQuestion: parsed.clarificationQuestion,
      };
    }

    log.info('SQL query generated', {
      userQuery,
      sql: parsed.sql,
      documentIds: parsed.document_ids,
      confidence: parsed.confidence,
    });

    return {
      sql: parsed.sql,
      explanation: parsed.explanation,
      documentIds: parsed.document_ids || [],
      needsClarification: false,
    };
  } catch (error) {
    log.error('SQL generation failed', {
      error: error instanceof Error ? error.message : String(error),
      userQuery,
    });
    throw new Error('Failed to generate SQL query');
  }
}

/**
 * Execute query against document_data table
 * Uses Supabase client instead of raw SQL for better security
 */
export async function executeQuery(
  documentId: string,
  filters: any,
  userId: string
): Promise<{ rows: any[]; rowCount: number }> {
  try {
    log.info('Executing tabular query', { documentId, userId });

    // Query document_data table with filters
    let query = supabase
      .from('document_data')
      .select('row_data, row_index, document_metadata')
      .eq('document_id', documentId);

    // Apply filters if provided (for future use)
    // For now, just get all rows for the document

    const { data, error } = await query;

    if (error) {
      log.error('Query execution failed', { error, documentId });
      throw new Error(`Query failed: ${error.message}`);
    }

    // Extract just the row_data from results
    const rows = (data || []).map((row) => row.row_data);

    log.info('Query executed successfully', { rowCount: rows.length });

    return {
      rows,
      rowCount: rows.length,
    };
  } catch (error) {
    log.error('Query execution error', {
      error: error instanceof Error ? error.message : String(error),
      documentId,
    });
    throw error;
  }
}

/**
 * Format query results as natural language response
 */
export async function formatResults(
  userQuery: string,
  sqlQuery: string,
  results: any[],
  explanation: string,
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<string> {
  try {
    const provider = LLMFactory.getProvider(model);

    const systemPrompt = `You are a data analyst assistant. Format SQL query results into a clear, natural language response.

**Guidelines:**
- Present data in a clear, organized way (tables, lists, or prose as appropriate)
- Highlight key insights and patterns
- Use markdown formatting for readability
- Be concise but complete
- If results are empty, explain that clearly`;

    const userPrompt = `User asked: ${userQuery}

SQL Query: ${sqlQuery}

Query Explanation: ${explanation}

Results (${results.length} rows):
${JSON.stringify(results, null, 2)}

Format these results into a natural language response.`;

    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model,
      { temperature: 0.7 }
    );

    return response.content;
  } catch (error) {
    log.error('Result formatting failed', { error });
    // Fallback to basic formatting
    return `Found ${results.length} results:\n\n${JSON.stringify(results, null, 2)}`;
  }
}

/**
 * Retrieve tabular data WITHOUT formatting a response
 * Returns raw query results for master agent to synthesize
 */
export async function retrieveData(
  userQuery: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<{
  success: boolean;
  data: any[];
  explanation?: string;
  error?: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}> {
  try {
    // 1. Get available tabular documents
    const documents = await getTabularDocuments(userId);

    if (documents.length === 0) {
      return {
        success: false,
        data: [],
        error: 'No tabular documents found',
      };
    }

    // 2. Generate SQL query using AI with conversation history
    const { sql, explanation, documentIds, needsClarification, clarificationQuestion } = await generateSQLQuery(
      userQuery,
      documents,
      conversationHistory,
      model
    );

    // If clarification is needed, return early with the clarification question
    if (needsClarification) {
      log.info('Clarification needed for tabular query', {
        userId,
        clarificationQuestion,
      });

      return {
        success: true,
        data: [],
        explanation,
        needsClarification: true,
        clarificationQuestion,
      };
    }

    log.info('Generated SQL for tabular query', {
      userId,
      sql,
      documentIds,
    });

    // 3. Execute the generated SQL query using RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_tabular_query', {
      p_user_id: userId,
      p_query: sql,
    });

    if (rpcError) {
      log.error('Tabular query execution failed', {
        error: rpcError,
        sql,
      });
      return {
        success: false,
        data: [],
        error: `Query failed: ${rpcError.message}`,
      };
    }

    // Log raw RPC result for debugging
    log.info('RPC result received', {
      userId,
      rpcResultType: typeof rpcResult,
      rpcResultKeys: rpcResult ? Object.keys(rpcResult) : [],
      success: rpcResult?.success,
      hasData: !!rpcResult?.data,
      dataLength: Array.isArray(rpcResult?.data) ? rpcResult.data.length : 'not an array',
    });

    // RPC function returns {success, data: [...], row_count, execution_time_ms}
    if (!rpcResult?.success) {
      log.error('Tabular query execution failed', {
        error: rpcResult?.error || 'Unknown error',
        sql,
      });
      return {
        success: false,
        data: [],
        error: rpcResult?.error || 'Query execution failed',
      };
    }

    log.info('Tabular data retrieved', {
      userId,
      rowCount: rpcResult.data?.length || 0,
      executionTimeMs: rpcResult.execution_time_ms,
    });

    return {
      success: true,
      data: rpcResult.data || [],
      explanation,
    };
  } catch (error) {
    log.error('Tabular data retrieval failed', {
      error: error instanceof Error ? error.message : String(error),
      userQuery,
      userId,
    });

    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export singleton instance
export const tabularAgent = {
  hasTabularDocuments,
  getTabularDocuments,
  retrieveData,
};
