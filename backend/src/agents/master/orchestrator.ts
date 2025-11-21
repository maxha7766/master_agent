/**
 * Master Agent Orchestrator
 * Central hub that coordinates all user interactions
 * - Queries documents table to understand available knowledge
 * - Decides which sub-agents to use (RAG, Tabular, SQL)
 * - Retrieves raw data from sub-agents
 * - Synthesizes conversational responses
 */

import { supabase } from '../../models/database.js';
import { LLMFactory } from '../../services/llm/factory.js';
import { ragAgent } from '../rag/index.js';
import { tabularAgent } from '../tabular/index.js';
import { log } from '../../lib/logger.js';
import { retrieveRelevantMemories, formatMemoriesForPrompt } from '../../services/memory/memoryManager.js';
import { retrieveRelevantEntities } from '../../services/memory/entityManager.js';
import { generateTemporalContext, formatTemporalContextForPrompt } from '../../services/temporal/timeContext.js';
import type { StreamChunk, SourceMetadata } from '../../services/llm/provider.js';
import type { ChatSettings } from './router.js';

interface DocumentInfo {
  id: string;
  file_name: string;
  file_type: string;
  row_count?: number;
  column_count?: number;
  chunk_count?: number;
  summary?: string;
  isTabular: boolean;
}

/**
 * Query documents table to understand available knowledge
 */
async function queryAvailableDocuments(userId: string): Promise<DocumentInfo[]> {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, row_count, column_count, chunk_count, summary')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error || !documents) {
      log.error('Failed to query documents', { userId, error });
      return [];
    }

    return documents.map((doc) => ({
      ...doc,
      isTabular: !!(doc.row_count && doc.row_count > 0),
    }));
  } catch (error) {
    log.error('Error querying documents', { userId, error });
    return [];
  }
}

/**
 * Decide which sub-agents to call based on query and available documents
 */
/**
 * Fast heuristic-based routing decision (replaces slow LLM call)
 * Reduces latency from ~1-3 seconds to ~1-5ms
 */
function decideSubAgents(
  userQuery: string,
  documents: DocumentInfo[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  model?: string // Kept for compatibility but not used
): {
  useRAG: boolean;
  useTabular: boolean;
  reasoning: string;
} {
  if (documents.length === 0) {
    return {
      useRAG: false,
      useTabular: false,
      reasoning: 'No documents available',
    };
  }

  const hasTextDocs = documents.some((d) => !d.isTabular && d.chunk_count);
  const hasTabularDocs = documents.some((d) => d.isTabular);

  const query = userQuery.toLowerCase();

  // Tabular data patterns (counts, queries, listings, numbers)
  const tabularKeywords = /\b(count|how many|sum|total|average|mean|median|max|min|highest|lowest|top|bottom|list|show|table|row|column|csv|excel|data|query|filter|sort|order|group|where|select)\b/i;
  const hasTabularIntent = tabularKeywords.test(query);

  // Follow-up patterns (pronouns that refer to previous conversation)
  const followUpPatterns = /\b(them|it|those|that|these|show me|list|display)\b/i;
  const isFollowUp = followUpPatterns.test(query);

  // Check if recent conversation mentioned tabular concepts
  const recentTabular = conversationHistory.slice(-2).some((msg) =>
    msg.role === 'assistant' && /\b(rows?|columns?|table|count|total|sum|average)\b/i.test(msg.content)
  );

  // Semantic search patterns (explanations, summaries, concepts)
  const ragKeywords = /\b(explain|describe|what is|tell me about|summarize|summary|definition|meaning|concept|why|how does|background|context|information about)\b/i;
  const hasRAGIntent = ragKeywords.test(query);

  // Decision logic
  let useTabular = false;
  let useRAG = false;
  let reasoning = '';

  // Prioritize tabular if we have strong signals
  if (hasTabularDocs && (hasTabularIntent || (isFollowUp && recentTabular))) {
    useTabular = true;
    reasoning = hasTabularIntent
      ? 'Tabular keywords detected (count/list/query)'
      : 'Follow-up to recent tabular conversation';
  }
  // Use RAG for semantic/explanatory queries
  else if (hasTextDocs && hasRAGIntent) {
    useRAG = true;
    reasoning = 'Semantic search keywords detected (explain/describe/what is)';
  }
  // Default: use RAG if we have text docs and no strong tabular signal
  else if (hasTextDocs && !hasTabularIntent) {
    useRAG = true;
    reasoning = 'Text search (no specific tabular intent)';
  }
  // Fallback to tabular if only tabular docs available
  else if (hasTabularDocs && !hasTextDocs) {
    useTabular = true;
    reasoning = 'Only tabular documents available';
  }
  // Last resort: direct response (no retrieval)
  else {
    reasoning = 'No clear retrieval pattern - direct response';
  }

  log.info('Sub-agent decision made (heuristic)', {
    useRAG,
    useTabular,
    reasoning,
    hasTabularIntent,
    hasRAGIntent,
    isFollowUp,
    recentTabular
  });

  return { useRAG, useTabular, reasoning };
}

/**
 * Synthesize conversational response from retrieved data
 */
async function* synthesizeResponse(
  userQuery: string,
  userId: string,
  documents: DocumentInfo[],
  ragContext: any[],
  tabularData: any,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string }>,
  model: string = 'claude-sonnet-4-5-20250929',
  temperature: number = 0.7,
  chatSettings?: ChatSettings,
  conversationMetadata?: { startTime?: Date; lastMessageTime?: Date }
): AsyncGenerator<StreamChunk> {
  const provider = LLMFactory.getProvider(model);

  // Generate temporal context
  let temporalContext = '';
  try {
    const context = generateTemporalContext(
      conversationMetadata?.lastMessageTime,
      conversationMetadata?.startTime
    );
    temporalContext = formatTemporalContextForPrompt(context);

    log.info('Temporal context generated', {
      userId,
      timeOfDay: context.timeOfDay,
      timeSinceLastMessage: context.timeSinceLastMessage?.category,
    });
  } catch (error) {
    log.error('Failed to generate temporal context', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Retrieve relevant memories and entities (filtered more strictly)
  let memoryContext = '';
  try {
    const memories = await retrieveRelevantMemories(userQuery, userId, {
      topK: 3, // Reduced from 5 to prevent overuse
      minSimilarity: 0.82, // Increased from 0.7 for better relevance
    });

    if (memories.length > 0) {
      memoryContext = formatMemoriesForPrompt(memories);
      log.info('Memories retrieved for context', {
        userId,
        count: memories.length,
      });
    }
  } catch (error) {
    log.error('Failed to retrieve memories', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
  }

  // Build document list
  const documentList = documents
    .map((doc, i) => {
      if (doc.isTabular) {
        return `${i + 1}. ${doc.file_name} (${doc.row_count} rows, ${doc.column_count} columns)`;
      } else {
        return `${i + 1}. ${doc.file_name} (${doc.chunk_count} text chunks)`;
      }
    })
    .join('\n');

  // Build retrieved context
  let retrievedContext = '';

  if (ragContext && ragContext.length > 0) {
    retrievedContext += '\n\n**Context from Text Documents:**\n';
    retrievedContext += ragContext
      .map((chunk, i) => {
        const source = chunk.fileName
          ? `${chunk.fileName}${chunk.pageNumber ? ` (page ${chunk.pageNumber})` : ''}`
          : 'Document';
        return `[${i + 1}] From ${source}:\n${chunk.content}`;
      })
      .join('\n\n');
  }

  if (tabularData && tabularData.success && tabularData.data.length > 0) {
    retrievedContext += '\n\n**Data from Tabular Documents:**\n';
    retrievedContext += `Query: ${tabularData.explanation || 'Retrieved data'}\n`;
    retrievedContext += `Results: ${JSON.stringify(tabularData.data, null, 2)}`;

    // Log what data is being passed to synthesis
    log.info('Tabular data passed to synthesis', {
      rowCount: tabularData.data.length,
      firstRow: tabularData.data[0],
      dataPreview: JSON.stringify(tabularData.data.slice(0, 3))
    });
  }

  // Build unified guidelines with executive assistant personality
  const strictMode = chatSettings?.ragOnlyMode;

  const systemPrompt = strictMode
    ? `You are a long-time executive assistant helping your user with their documents and information. You're accurate, anticipatory, and direct — you solve problems without unnecessary pleasantries.

${temporalContext}

**User's Documents:**
${documentList}

${memoryContext}

**Your Approach:**
- Lead with the answer, not process details
- Ask clarifying questions when requests are vague or ambiguous — don't rubber-stamp unclear ideas
- Only use memories when directly relevant to the current task (don't force them into conversation)
- Adapt your tone to the user's mood:
  * Busy → lead with the answer
  * Curious → provide context and depth
  * Frustrated → simplify and solve
- If you sense contradiction or confusion, ask before proceeding
- Cite sources only when asked ("where did you find that?")

**Challenging Exceptions (do NOT challenge these):**
- Emotional processing or venting
- Personal preferences ("I prefer X over Y")
- Identity statements ("I am...", "I feel...")
- Setting boundaries ("Don't do X")

**STRICT DATA RULES (RAG-ONLY MODE):**
You MUST only use information from the retrieved context below. If the data isn't there, say "Not seeing that in the documents" or "The documents don't have that information." Use EXACT data — don't paraphrase, invent, or add plausible details. You may interpret explicit data (e.g., calculate totals, compare values) but not fabricate new entries.

Example: If Results shows 2 cards, list those 2 cards exactly — not 3, not similar ones, those 2.

${retrievedContext}`
    : `You are a long-time executive assistant helping your user with their documents and information. You're accurate, anticipatory, and direct — you solve problems without unnecessary pleasantries.

${temporalContext}

**User's Documents:**
${documentList}

${memoryContext}

**Your Approach:**
- Lead with the answer, not process details
- Ask clarifying questions when requests are vague or ambiguous — don't rubber-stamp unclear ideas
- Only use memories when directly relevant to the current task (don't force them into conversation)
- Adapt your tone to the user's mood:
  * Busy → lead with the answer
  * Curious → provide context and depth
  * Frustrated → simplify and solve, then ask clarifying questions
- If you sense contradiction or confusion in the request, ask before proceeding
- Cite sources only when asked ("where did you find that?", "what's your source?")
- When memories contradict each other or seem outdated, acknowledge it and ask for clarification
- Avoid restating information the user just told you — acknowledge and build on it instead

**Challenging Exceptions (do NOT challenge these):**
- Emotional processing or venting
- Personal preferences ("I prefer X over Y")
- Identity statements ("I am...", "I feel...")
- Setting boundaries ("Don't do X")

**Data Accuracy:**
When retrieved data IS provided below, use ONLY that data. Don't fabricate, add plausible details, or invent similar items. List EXACTLY what's in the data. If you need to add general context, explicitly distinguish it: "Based on the data I have..."

${retrievedContext}`;

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 10 turns)
  const recentHistory = conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current query
  messages.push({ role: 'user', content: userQuery });

  // Stream response
  for await (const chunk of provider.chatStream(messages, model, { temperature })) {
    yield chunk;
  }
}

/**
 * Main orchestration function
 * Handles all user queries end-to-end
 */
export async function* handleUserQuery(
  userQuery: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string }> = [],
  model: string = 'claude-sonnet-4-5-20250929',
  temperature: number = 0.7,
  chatSettings?: ChatSettings
): AsyncGenerator<StreamChunk> {
  // Extract temporal metadata from conversation history
  const conversationMetadata: { startTime?: Date; lastMessageTime?: Date } = {};

  if (conversationHistory.length > 0) {
    // Get the first message time (conversation start)
    const firstMessage = conversationHistory[0];
    if (firstMessage.created_at) {
      conversationMetadata.startTime = new Date(firstMessage.created_at);
    }

    // Get the last message time (excluding the current one being processed)
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage.created_at) {
      conversationMetadata.lastMessageTime = new Date(lastMessage.created_at);
    }
  }
  try {
    log.info('🎯 MASTER AGENT START', { userId, query: userQuery.substring(0, 100), chatSettings });

    // Step 1: Query documents table
    const documents = await queryAvailableDocuments(userId);

    log.info('📚 STEP 1: Documents queried', {
      userId,
      documentCount: documents.length,
      documents: documents.map(d => ({ name: d.file_name, isTabular: d.isTabular, chunks: d.chunk_count }))
    });

    // If no documents, check RAG-only mode
    if (documents.length === 0) {
      const provider = LLMFactory.getProvider(model);

      // If RAG-only mode is enabled, refuse to answer without documents
      if (chatSettings?.ragOnlyMode) {
        yield {
          content: "I don't have any information in my database to answer that question. Please upload documents or tables for me to search through.",
          done: true,
        };
        return;
      }

      // Otherwise, use general knowledge
      const systemPrompt = `You are a helpful, friendly AI assistant. The user hasn't uploaded any documents yet. Be conversational and brief.`;

      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userQuery },
      ];

      for await (const chunk of provider.chatStream(messages, model, { temperature })) {
        yield chunk;
      }
      return;
    }

    // Step 2: Decide which sub-agents to use
    const decision = await decideSubAgents(userQuery, documents, conversationHistory, model);

    log.info('🤖 STEP 2: Agent decision made', {
      userId,
      decision,
      ragOnlyMode: chatSettings?.ragOnlyMode
    });

    // Check if this is a meta-query about the document list itself
    const isMetaQuery = /what (documents|files|data|tables).*(?:do you have|are (?:in|available)|exist|uploaded)/i.test(userQuery) ||
                        /list.*(?:documents|files|tables)/i.test(userQuery) ||
                        /show.*(?:documents|files|tables)/i.test(userQuery);

    // Override decision if RAG-only mode is enabled
    if (chatSettings?.ragOnlyMode) {
      const hasTextDocs = documents.some((d) => !d.isTabular && d.chunk_count);

      log.info('🔒 RAG-only mode active', { hasTextDocs, currentUseRAG: decision.useRAG, isMetaQuery });

      // Don't force RAG for meta-queries about the document list
      if (isMetaQuery) {
        log.info('📋 Meta-query detected - will answer with document list info', { userId });
        decision.useRAG = false;
        decision.useTabular = false;
        decision.reasoning = 'Meta-query about document list - answering with system information';
      }
      // Force RAG if text documents are available and not a meta-query
      else if (hasTextDocs && !decision.useRAG) {
        log.info('⚡ RAG-only mode: FORCING useRAG=true', { userId, originalDecision: decision.useRAG });
        decision.useRAG = true;
        decision.reasoning += ' (Forced by RAG-only mode)';
      }

      // Block tabular queries in RAG-only mode (only allow text document search)
      if (decision.useTabular && !isMetaQuery) {
        log.info('🚫 RAG-only mode: BLOCKING tabular query', { userId });
        decision.useTabular = false;
        decision.reasoning += ' (Tabular blocked by RAG-only mode)';
      }
    }

    // Step 3: Retrieve data from sub-agents
    let ragContext: any[] = [];
    let tabularData: any = null;

    if (decision.useRAG) {
      log.info('🔍 STEP 3A: Retrieving RAG context', {
        userId,
        query: userQuery,
        settings: {
          topK: chatSettings?.topK ?? 5,
          minRelevanceScore: chatSettings?.minRelevanceScore ?? 0.0,
          ragOnlyMode: chatSettings?.ragOnlyMode ?? false
        }
      });
      ragContext = await ragAgent.retrieveContext(userQuery, userId, {
        topK: chatSettings?.topK ?? 5,
        minRelevanceScore: chatSettings?.minRelevanceScore ?? 0.0,
        ragOnlyMode: chatSettings?.ragOnlyMode ?? false,
      });
      log.info('✅ RAG context retrieved', {
        userId,
        chunks: ragContext.length,
        preview: ragContext.slice(0, 2).map(c => ({
          doc: c.fileName,
          page: c.pageNumber,
          score: c.score,
          content: c.content?.substring(0, 100)
        }))
      });
    }

    if (decision.useTabular) {
      log.info('Retrieving tabular data', { userId });
      tabularData = await tabularAgent.retrieveData(userQuery, userId, conversationHistory, model);

      // If clarification is needed, return early with the clarification question
      if (tabularData?.needsClarification) {
        log.info('Tabular agent needs clarification', { userId, clarificationQuestion: tabularData.clarificationQuestion });

        yield {
          content: tabularData.clarificationQuestion || 'Could you please clarify what you\'d like me to find?',
          done: true,
        };
        return;
      }

      log.info('Tabular data retrieved', { userId, rows: tabularData.data?.length || 0 });
    }

    // Step 4: Build source metadata
    const sources: SourceMetadata = {};

    if (ragContext && ragContext.length > 0) {
      // Group by document
      const ragDocMap = new Map<string, { fileName: string; pages: Set<number>; chunkCount: number }>();

      for (const chunk of ragContext) {
        const docId = chunk.documentId || 'unknown';
        if (!ragDocMap.has(docId)) {
          ragDocMap.set(docId, {
            fileName: chunk.fileName || 'Unknown document',
            pages: new Set(),
            chunkCount: 0,
          });
        }
        const doc = ragDocMap.get(docId)!;
        if (chunk.pageNumber) doc.pages.add(chunk.pageNumber);
        doc.chunkCount++;
      }

      sources.rag = Array.from(ragDocMap.entries()).map(([documentId, data]) => ({
        documentId,
        fileName: data.fileName,
        pages: Array.from(data.pages).sort((a, b) => a - b),
        chunkCount: data.chunkCount,
      }));
    }

    if (tabularData && tabularData.success && tabularData.data.length > 0) {
      // Find the tabular document
      const tabularDoc = documents.find((d) => d.isTabular);
      if (tabularDoc) {
        sources.tabular = [{
          documentId: tabularDoc.id,
          fileName: tabularDoc.file_name,
          rowCount: tabularData.data.length,
        }];
      }
    }

    // Step 4.5: Check if RAG-only mode is enabled and no data was retrieved
    const hasRetrievedData = (ragContext && ragContext.length > 0) || (tabularData && tabularData.success && tabularData.data.length > 0);

    log.info('📊 STEP 4: Data retrieval check', {
      userId,
      hasRetrievedData,
      ragChunks: ragContext.length,
      tabularRows: tabularData?.data?.length || 0,
      ragOnlyMode: chatSettings?.ragOnlyMode,
      isMetaQuery
    });

    // Skip the "no data" check for meta-queries - they don't need retrieved data
    if (chatSettings?.ragOnlyMode && !hasRetrievedData && !isMetaQuery) {
      log.info('⚠️ RAG-only mode: NO RELEVANT DATA FOUND', {
        userId,
        useRAG: decision.useRAG,
        useTabular: decision.useTabular,
        ragChunks: ragContext.length,
        tabularRows: tabularData?.data?.length || 0,
        reasoning: decision.reasoning
      });
      yield {
        content: "I searched your documents but couldn't find relevant information to answer that question. This could mean:\n- The content isn't in your uploaded documents\n- Try rephrasing your query\n- Try lowering the relevance score threshold in settings",
        done: true,
      };
      return;
    }

    // Step 5: Synthesize response and stream chunks
    console.log('\n========== SYNTHESIS STAGE ==========');
    console.log('Synthesizing response with:', {
      ragChunks: ragContext.length,
      tabularRows: tabularData?.data?.length || 0,
      ragOnlyMode: chatSettings?.ragOnlyMode,
      documents: documents.map(d => d.file_name)
    });

    log.info('Synthesizing response', { userId });
    yield* synthesizeResponse(
      userQuery,
      userId,
      documents,
      ragContext,
      tabularData,
      conversationHistory,
      model,
      temperature,
      chatSettings,
      conversationMetadata
    );

    // Step 6: Yield metadata chunk at the end
    yield {
      content: '',
      done: true,
      sources: Object.keys(sources).length > 0 ? sources : undefined,
    };

    log.info('Master agent completed', { userId });
  } catch (error) {
    log.error('Master agent error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });

    yield {
      content: "I encountered an error processing your request. Please try again.",
      done: true,
    };
  }
}
