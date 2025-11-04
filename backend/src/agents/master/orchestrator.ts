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
async function decideSubAgents(
  userQuery: string,
  documents: DocumentInfo[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  model: string = 'claude-sonnet-4-20250514'
): Promise<{
  useRAG: boolean;
  useTabular: boolean;
  reasoning: string;
}> {
  if (documents.length === 0) {
    return {
      useRAG: false,
      useTabular: false,
      reasoning: 'No documents available',
    };
  }

  const hasTextDocs = documents.some((d) => !d.isTabular && d.chunk_count);
  const hasTabularDocs = documents.some((d) => d.isTabular);

  try {
    const provider = LLMFactory.getProvider(model);

    const documentContext = documents
      .map((doc) => {
        if (doc.isTabular) {
          return `- ${doc.file_name} (Tabular: ${doc.row_count} rows, ${doc.column_count} columns)`;
        } else {
          return `- ${doc.file_name} (Text document: ${doc.chunk_count} chunks)`;
        }
      })
      .join('\n');

    // Build conversation context
    const conversationContext = conversationHistory.length > 0
      ? `\n\n**Recent Conversation:**\n${conversationHistory
          .slice(-6) // Last 3 exchanges
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}`)
          .join('\n')}\n`
      : '';

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
User Query: "${userQuery}"

Which retrieval system(s) should be used?`;

    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model,
      { temperature: 0.1 }
    );

    const decision = JSON.parse(response.content);

    // Validate decision against available documents
    if (decision.useRAG && !hasTextDocs) {
      decision.useRAG = false;
      decision.reasoning += ' (No text documents available)';
    }
    if (decision.useTabular && !hasTabularDocs) {
      decision.useTabular = false;
      decision.reasoning += ' (No tabular documents available)';
    }

    log.info('Sub-agent decision made', {
      useRAG: decision.useRAG,
      useTabular: decision.useTabular,
      reasoning: decision.reasoning,
    });

    return decision;
  } catch (error) {
    log.error('Sub-agent decision failed', { error });
    // Fallback: use RAG if text docs, tabular if tabular docs
    return {
      useRAG: hasTextDocs,
      useTabular: hasTabularDocs,
      reasoning: 'Fallback decision based on available documents',
    };
  }
}

/**
 * Synthesize conversational response from retrieved data
 */
async function* synthesizeResponse(
  userQuery: string,
  documents: DocumentInfo[],
  ragContext: any[],
  tabularData: any,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string = 'claude-sonnet-4-20250514',
  temperature: number = 0.7,
  chatSettings?: ChatSettings
): AsyncGenerator<StreamChunk> {
  const provider = LLMFactory.getProvider(model);

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

  // Build strict guidelines for RAG-only mode
  const strictMode = chatSettings?.ragOnlyMode;
  const guidelines = strictMode
    ? `**CRITICAL RULES (RAG-ONLY MODE ENABLED):**
- You MUST ONLY use information from the retrieved context below
- DO NOT use your general knowledge or training data AT ALL
- DO NOT fabricate, infer, or extrapolate information not explicitly present in the context
- If the retrieved context doesn't contain enough information to answer, say: "I don't have enough information in my documents to answer that question."
- When listing items, ONLY list the EXACT items present in the retrieved data - no more, no less
- COPY the exact data from the Results section - do not paraphrase, summarize, or invent similar items
- Be conversational and friendly, but STRICTLY stay within the provided context

**Example:**
If Results shows: [{"title": "2024 Topps Chrome Card A", "price": 50}, {"title": "2022 Bowman Card B", "price": 10}]
You MUST list exactly those 2 cards with those exact titles and prices.
You MUST NOT list different cards or make up additional details.`
    : `**Guidelines:**
- Be conversational and friendly (like a helpful colleague)
- Answer directly and concisely
- Don't mention backend processes, agents, or technical details
- Don't cite sources unless the user specifically asks (e.g., "where did you find that?", "what's your source?")
- When asked for sources, clearly identify which documents you used:
  * For text documents: mention the filename and page number if available
  * For tabular documents: mention the CSV/Excel filename
  * Be specific: "I found that in [filename]" or "That information comes from your [filename] document"
- If you don't have enough information, say so briefly
- Remember the conversation history - if asked about sources, refer to your previous answer

**CRITICAL ANTI-HALLUCINATION RULES:**
- When retrieved data IS provided below, you MUST use ONLY that data
- DO NOT add details, examples, or information not present in the retrieved context
- DO NOT fabricate similar items or make up plausible-sounding data
- When listing items from retrieved data, list EXACTLY what's in the data - no more, no less
- If the data seems incomplete or you want to add context from general knowledge, explicitly say "Based on the data I have..." to distinguish it
- For factual queries about uploaded documents, stick to what's actually in the retrieved context`;

  const systemPrompt = `You are a helpful, friendly AI assistant. You have access to the user's document library and can answer questions about their uploaded files.

**User's Documents:**
${documentList}

${guidelines}

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
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  model: string = 'claude-sonnet-4-20250514',
  temperature: number = 0.7,
  chatSettings?: ChatSettings
): AsyncGenerator<StreamChunk> {
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
      documents,
      ragContext,
      tabularData,
      conversationHistory,
      model,
      temperature,
      chatSettings
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
