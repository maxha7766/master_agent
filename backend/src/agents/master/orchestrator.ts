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
import { generateTemporalContext, formatTemporalContextForPrompt } from '../../services/temporal/timeContext.js';
import type { StreamChunk, SourceMetadata } from '../../services/llm/provider.js';
import type { ChatSettings } from './router.js';
import { executeImageGenerationTool } from './tools/imageGenerationTool.js';
import { executeVideoGenerationTool } from './tools/videoGenerationTool.js';

interface DocumentInfo {
  id: string;
  file_name: string;
  file_type: string;
  row_count?: number;
  column_count?: number;
  chunk_count?: number;
  summary?: string;
  isTabular: boolean;
  created_at?: string; // When the document was uploaded
}

// ============================================================================
// OPTIMIZATION: Document cache with 5-minute TTL
// ============================================================================
const documentCache = new Map<string, { documents: DocumentInfo[]; timestamp: number }>();
const DOCUMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper to check if conversation has any images
 */
function conversationHasImage(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; image_url?: string }>
): boolean {
  return conversationHistory.some((msg) => !!msg.image_url);
}

/**
 * Query documents table to understand available knowledge
 * OPTIMIZED: Uses 5-minute cache to avoid repeated DB calls
 */
async function queryAvailableDocuments(userId: string): Promise<DocumentInfo[]> {
  try {
    // Check cache first
    const cached = documentCache.get(userId);
    if (cached && Date.now() - cached.timestamp < DOCUMENT_CACHE_TTL) {
      log.info('📦 Using cached document list', { userId, docCount: cached.documents.length });
      return cached.documents;
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, row_count, column_count, chunk_count, summary, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error || !documents) {
      log.error('Failed to query documents', { userId, error });
      return [];
    }

    const result = documents.map((doc) => ({
      ...doc,
      isTabular: !!(doc.row_count && doc.row_count > 0),
      created_at: doc.created_at,
    }));

    // Update cache
    documentCache.set(userId, { documents: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    log.error('Error querying documents', { userId, error });
    return [];
  }
}

/**
 * OPTIMIZED: Smart 3-tier image intent detection
 * Tier 1: Fast regex for obvious cases (~1ms)
 * Tier 2: Context-aware skip - no image words = skip LLM (~0ms)
 * Tier 3: LLM fallback for ambiguous cases (runs in parallel with doc query)
 */
async function detectImageIntentSmart(
  userQuery: string,
  model: string,
  hasAttachedImage: boolean,
  hasImageInConversation: boolean,
  documentQueryPromise?: Promise<DocumentInfo[]>
): Promise<{
  isImageRequest: boolean;
  operation: 'text-to-image' | 'image-to-image' | 'inpaint' | 'upscale' | 'variation' | null;
  reasoning: string;
}> {
  const query = userQuery.toLowerCase();

  // ========== TIER 1: Fast regex for obvious cases ==========
  const textToImagePatterns = [
    /\b(generate|create|make|draw|design|render|produce)\b.*\b(image|picture|photo|illustration|artwork|visual)\b/i,
    /\b(image|picture|photo)\b.*\b(of|showing|with)\b/i,
    /\bgive me (a|an)?\s*(picture|image|photo)/i,
    /\bmake me (a|an)?\s*(picture|image|photo)/i,
    /\bvisualize\b/i,
    /\bcan you (create|generate|make|draw)\b.*\b(image|picture|photo)?\b/i,
  ];

  const imageEditPatterns = [
    /\b(change|modify|edit|adjust)\b.*(image|picture|photo|it|this|that)\b/i,
    /\b(add|remove|replace)\b.*(to|from|in)\s*(the|this|that)?\s*(image|picture|photo|it)?\b/i,
    /\bmake (it|the image|the picture|this|that|him|her|them)\s+\w+/i,
    /\bgive (him|her|it|them|the \w+)\s+(a|an)?\s*\w+/i,
    /\b(brighter|darker|warmer|cooler|bigger|smaller|taller|shorter)\b/i,
    /\bcan you (change|add|remove|make)\b/i,
  ];

  // Clear text-to-image match
  if (textToImagePatterns.some(p => p.test(query))) {
    log.info('🎨 Image intent: TIER 1 regex match (text-to-image)', { query: query.substring(0, 50) });
    return { isImageRequest: true, operation: 'text-to-image', reasoning: 'Clear image generation pattern (regex)' };
  }

  // Clear image edit match (only if image context exists)
  if ((hasAttachedImage || hasImageInConversation) && imageEditPatterns.some(p => p.test(query))) {
    log.info('🎨 Image intent: TIER 1 regex match (image-to-image)', { query: query.substring(0, 50) });
    return { isImageRequest: true, operation: 'image-to-image', reasoning: 'Clear image edit pattern with source image (regex)' };
  }

  // ========== TIER 2: Context-aware skip ==========
  // If no image-related words AND no image context, skip LLM entirely
  const imageAdjacentWords = /\b(show|see|look|visual|picture|image|photo|draw|illustration|artwork|render|display|create|generate|make)\b/i;

  if (!imageAdjacentWords.test(query) && !hasAttachedImage && !hasImageInConversation) {
    log.info('🎨 Image intent: TIER 2 skip (no image context)', { query: query.substring(0, 50) });
    return { isImageRequest: false, operation: null, reasoning: 'No image-related context (skipped LLM)' };
  }

  // ========== TIER 3: LLM fallback (runs in parallel with doc query) ==========
  // Only reaches here for ambiguous cases with image context
  log.info('🎨 Image intent: TIER 3 LLM fallback', {
    query: query.substring(0, 50),
    hasAttachedImage,
    hasImageInConversation
  });

  const provider = LLMFactory.getProvider(model);

  const prompt = `You are an intent classifier with image generation capabilities. Analyze the user's query to determine if they want to generate, create, or manipulate an image.

IMPORTANT: You CAN generate images. When users ask for pictures, photos, images, or visual content, classify it as an image request.

User query: "${userQuery}"
Context: ${hasAttachedImage ? 'User has attached an image' : hasImageInConversation ? 'There is a previous image in the conversation' : 'No images in context'}

Examples of NEW image creation (text-to-image):
- "can you give me a picture of a dog with a hat?" → operation: "text-to-image"
- "create an image of a sunset" → operation: "text-to-image"
- "I'd love to see what that looks like" → operation: "text-to-image"

Examples of EDITING an existing image (image-to-image):
- "can you give the cat a red collar" → operation: "image-to-image"
- "make the ball red" → operation: "image-to-image"
- "add a hat to the dog" → operation: "image-to-image"
- "make it brighter" → operation: "image-to-image"

Respond in JSON format only:
{"isImageRequest": true/false, "operation": "text-to-image" | "image-to-image" | null, "reasoning": "brief"}`;

  // Run LLM in parallel with document query if provided
  const llmPromise = provider.chat([{ role: 'user' as const, content: prompt }], model, { temperature: 0 });

  const [response] = await Promise.all([
    llmPromise,
    documentQueryPromise || Promise.resolve([]),
  ]);

  try {
    let jsonText = response.content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    return {
      isImageRequest: parsed.isImageRequest || false,
      operation: parsed.operation || null,
      reasoning: parsed.reasoning || 'LLM classification',
    };
  } catch (error) {
    log.error('Failed to parse image intent detection response', { response, error });
    return { isImageRequest: false, operation: null, reasoning: 'Failed to parse LLM response' };
  }
}


/**
 * Detect video generation intent
 */
async function detectVideoIntent(
  userQuery: string,
  model: string
): Promise<{
  isVideoRequest: boolean;
  operation: 'text-to-video' | 'image-to-video' | 'video-editing' | null;
  reasoning: string;
}> {
  const query = userQuery.toLowerCase();

  // Fast regex check
  const videoPatterns = [
    /\b(generate|create|make|produce)\b.*\b(video|movie|clip|animation)\b/i,
    /\b(video|movie|clip|animation)\b.*\b(of|showing|with)\b/i,
    /\bgive me (a|an)?\s*(video|movie|clip|animation)/i,
    /\bmake me (a|an)?\s*(video|movie|clip|animation)/i,
    /\banimate\b/i,
  ];

  if (videoPatterns.some(p => p.test(query))) {
    log.info('🎥 Video intent: Regex match', { query: query.substring(0, 50) });
    // Default to text-to-video unless "animate" is used
    const operation = /\banimate\b/i.test(query) ? 'image-to-video' : 'text-to-video';
    return { isVideoRequest: true, operation, reasoning: 'Clear video generation pattern (regex)' };
  }

  // Context-aware skip
  const videoKeywords = /\b(video|movie|clip|animation|animate|motion|moving)\b/i;
  if (!videoKeywords.test(query)) {
    return { isVideoRequest: false, operation: null, reasoning: 'No video-related context' };
  }

  // LLM Fallback
  const provider = LLMFactory.getProvider(model);
  const prompt = `Analyze if the user wants to generate or edit a video.
User query: "${userQuery}"

Capabilities:
- text-to-video: Create new video from text
- image-to-video: Animate an existing image
- video-editing: Edit an existing video

Respond in JSON: {"isVideoRequest": boolean, "operation": "text-to-video" | "image-to-video" | "video-editing" | null, "reasoning": "string"}`;

  try {
    const response = await provider.chat([{ role: 'user', content: prompt }], model, { temperature: 0 });
    let jsonText = response.content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonText);
    return {
      isVideoRequest: parsed.isVideoRequest || false,
      operation: parsed.operation || null,
      reasoning: parsed.reasoning || 'LLM classification',
    };
  } catch (error) {
    log.error('Failed to detect video intent', { error });
    return { isVideoRequest: false, operation: null, reasoning: 'Failed to parse LLM response' };
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
 * OPTIMIZED: Memory context is now passed in (retrieved in parallel earlier)
 */
async function* synthesizeResponse(
  userQuery: string,
  userId: string,
  documents: DocumentInfo[],
  ragContext: any[],
  tabularData: any,
  memoryContext: string, // OPTIMIZATION: Now passed in instead of fetched here
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string }>,
  model: string = 'claude-3-haiku-20240307',
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

  // Build document list with upload dates (most recent first)
  const documentList = documents
    .map((doc, i) => {
      const uploadDate = doc.created_at
        ? new Date(doc.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Chicago',
        })
        : 'Unknown date';
      if (doc.isTabular) {
        return `${i + 1}. ${doc.file_name} (${doc.row_count} rows, ${doc.column_count} columns) - uploaded ${uploadDate}`;
      } else {
        return `${i + 1}. ${doc.file_name} (${doc.chunk_count} text chunks) - uploaded ${uploadDate}`;
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

**User's Documents (most recent first):**
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
You MUST only use information from the retrieved context below. NEVER invent, guess, or add plausible-sounding details.

CRITICAL ACCURACY REQUIREMENTS:
1. **Quote or paraphrase only what's explicitly in the data** — if it's not there, it doesn't exist
2. **When citing facts, name the source**: "According to [document name]..." or "In the [document name] document..."
3. **If information is missing**, say clearly: "I don't see that in your documents" or "That information isn't in the files I have access to"
4. **Never assume or infer unstated information** — if a document mentions 3 items, there are exactly 3, not "several" or "many"
5. **Distinguish between data and general knowledge**: "Based on your documents..." vs "Generally speaking..."
6. **If you're uncertain, say so**: "I'm not confident about this" or "The documents don't specify"

FORBIDDEN BEHAVIORS:
- Making up document names, dates, or details that aren't explicitly provided
- Saying "your most recent document" unless you can see actual upload dates
- Adding "context" that sounds plausible but isn't from the source
- Conflating different documents or mixing up their contents

Example: If Results shows 2 cards, list those 2 cards exactly — not 3, not similar ones, those 2.

${retrievedContext}`
    : `You are Bob, a highly intelligent and conversational AI partner. You have a deep understanding of the user's documents and data, treating them as your own memory.

${temporalContext}

**Your Knowledge Base (User's Documents):**
${documentList}

${memoryContext}

**Your Personality & Style:**
- **Conversational & Human**: Speak naturally. Avoid stiff, robotic phrasing. **Do not use bullet points, numbered lists, or bold headers unless the user explicitly asks for a list, summary, or "breakdown".**
- **Synthesis over Listing**: When answering, weave facts together into a coherent narrative. Don't just list facts. Connect the dots.
- **RAG as Memory**: You "know" the information in the documents below. You don't need to say "According to document X" for every single fact. Use natural phrasing like "I recall from your research on..." or "Your notes mention that..." or simply state the fact if it fits the flow.
- **Accurate but Fluid**: Be precise with numbers and facts, but deliver them in flowing sentences.
- **Contextual**: If the user asks about a specific topic, use the retrieved info to have a discussion about it, not just a report dump.

**Tone:**
- Professional but warm.
- Intelligent and insightful.
- Direct but not abrupt.

**Data Handling:**
When retrieved data IS provided below, use ONLY that data for specifics. NEVER fabricate, guess, or add plausible-sounding private details.

CRITICAL REQUIREMENTS:
1. **No Lists**: Write in paragraphs. Use transition words. Make it flow.
2. **Source Awareness**: You can reference "your notes" or "the research," but don't feel the need to cite every sentence like a legal brief.
3. **Admit uncertainty**: If you don't know, say "I don't recall seeing that in your files" — never guess.
4. **Use upload dates**: Only reference "most recent" if you can see actual dates above.

FORBIDDEN:
- **Bullet points (unless requested)**
- Making up document names or contents
- Inventing dates, numbers, or details not in the data
- Saying "I remember you mentioned..." unless it's in the conversation history
- **Using <search> tags or outputting internal thought processes**: Never show your search strategy. Just provide the answer.
- **Hallucinating tool calls**: You do not have a search tool in this conversation. Use the provided context only.

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
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string; image_url?: string }> = [],
  model: string = 'claude-3-haiku-20240307',
  temperature: number = 0.7,
  chatSettings?: ChatSettings,
  attachedImageUrl?: string // Image attached via chat "+" button
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

    // OPTIMIZATION: Start document query immediately (will run in parallel if LLM fallback needed)
    const documentQueryPromise = queryAvailableDocuments(userId);

    // Step 0.5: Smart image intent detection (3-tier: regex → context skip → LLM parallel)
    const hasImageInConversation = conversationHasImage(conversationHistory);
    const imageIntent = await detectImageIntentSmart(
      userQuery,
      model,
      !!attachedImageUrl,
      hasImageInConversation,
      documentQueryPromise
    );

    // Step 0.6: Video Intent Detection
    const videoIntent = await detectVideoIntent(userQuery, model);

    if (videoIntent.isVideoRequest) {
      log.info('🎥 VIDEO GENERATION DETECTED', {
        userId,
        operation: videoIntent.operation,
        reasoning: videoIntent.reasoning
      });

      let sourceImage: string | undefined;
      let sourceVideo: string | undefined;

      // Find source media if needed
      if (videoIntent.operation === 'image-to-video') {
        if (attachedImageUrl) {
          sourceImage = attachedImageUrl;
        } else {
          // Search history for image
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            if (conversationHistory[i].image_url) {
              sourceImage = conversationHistory[i].image_url;
              break;
            }
          }
        }

        if (!sourceImage) {
          yield {
            content: "I can animate an image for you, but I need an image first. Please attach one or ask me to generate an image to animate.",
            done: true,
          };
          return;
        }
      }

      // Execute video generation
      const videoResult = await executeVideoGenerationTool(
        {
          operation: videoIntent.operation!,
          prompt: userQuery,
          sourceImage,
          sourceVideo,
        },
        userId,
        conversationHistory[0]?.['conversationId']
      );

      if (videoResult.success) {
        yield {
          content: `I've generated a video for you based on your request: "${userQuery}"`,
          done: true,
          // We can pass video URL in metadata or content if frontend supports it
          // Ideally frontend should handle video_url in metadata similar to image_url
          metadata: {
            ...videoResult.metadata,
            videoUrl: videoResult.videoUrl,
            type: 'video_generation_result'
          }
        };
        return;
      } else {
        yield {
          content: `I encountered an error generating the video: ${videoResult.error}`,
          done: true,
        };
        return;
      }
    }

    if (imageIntent.isImageRequest) {
      log.info('🎨 IMAGE GENERATION DETECTED', {
        userId,
        operation: imageIntent.operation,
        reasoning: imageIntent.reasoning
      });

      // For image editing operations, find the source image
      let sourceImage: string | undefined;
      const editingOperations = ['image-to-image', 'inpaint', 'upscale', 'variation'];

      log.info('Checking for image source', {
        operation: imageIntent.operation,
        hasAttachedImageUrl: !!attachedImageUrl,
        attachedImageUrl: attachedImageUrl?.substring(0, 80),
        historyLength: conversationHistory.length,
      });

      if (editingOperations.includes(imageIntent.operation!)) {
        // Priority 1: Use attached image from chat "+" button
        if (attachedImageUrl) {
          sourceImage = attachedImageUrl;
          log.info('Using attached image for editing', { sourceImage });
        } else {
          // Priority 2: Search conversation history backwards for the most recent image
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            if (conversationHistory[i].image_url) {
              sourceImage = conversationHistory[i].image_url;
              log.info('Found source image for editing from history', { sourceImage, messageIndex: i });
              break;
            }
          }
        }

        if (!sourceImage) {
          yield {
            content: "I'd love to edit that image, but I don't see an image to work with. You can either:\n1. Use the + button in the chat to attach an image\n2. Ask me to generate an image first, then ask me to edit it",
            done: true,
          };
          return;
        }
      }

      // For image editing with Flux Dev 2, craft a clear edit prompt
      let editPrompt = userQuery;

      if (sourceImage && imageIntent.operation === 'image-to-image') {
        // Flux Dev 2 works best with direct, simple prompts
        // Extract the core edit request and make it clear
        editPrompt = `${userQuery}. Keep everything else in the image the same.`;
      }

      // Execute image generation
      const imageResult = await executeImageGenerationTool(
        {
          operation: imageIntent.operation!,
          prompt: editPrompt,
          sourceImage, // Pass the source image for editing operations
        },
        userId,
        conversationHistory[0]?.['conversationId'] // Get conversationId if available
      );

      if (imageResult.success) {
        // Return success response with image
        const responseMessage = imageResult.imageUrls
          ? `I've generated ${imageResult.imageUrls.length} image variations for you.`
          : `I've generated an image for you.`;

        yield {
          content: responseMessage,
          done: true,
          imageUrl: imageResult.imageUrl,
          imageUrls: imageResult.imageUrls,
          metadata: imageResult.metadata,
        };

        log.info('✅ Image generation completed', {
          userId,
          costUsd: imageResult.costUsd,
          operation: imageIntent.operation
        });
        return;
      } else {
        // Return error response
        yield {
          content: `I encountered an error generating the image: ${imageResult.error}`,
          done: true,
        };
        return;
      }
    }

    // Step 1: Get documents (already started above, just await if not yet resolved)
    const documents = await documentQueryPromise;

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

      // Otherwise, use general knowledge with time awareness
      const temporalContext = generateTemporalContext();
      const timeContext = formatTemporalContextForPrompt(temporalContext);

      const systemPrompt = `You are a helpful, friendly AI assistant. The user hasn't uploaded any documents yet. Be conversational and brief.

${timeContext}

When asked about the current time or date, use the Current Time shown above. Always provide the time in a natural, conversational way.

IMPORTANT: Do not attempt to search or use <search> tags. You do not have access to external tools in this mode. Answer directly.`;

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

    // Step 3: Retrieve data from sub-agents IN PARALLEL (OPTIMIZATION)
    log.info('🔍 STEP 3: Starting parallel retrieval', {
      userId,
      useRAG: decision.useRAG,
      useTabular: decision.useTabular,
    });

    // Build parallel retrieval promises
    const ragPromise = decision.useRAG
      ? ragAgent.retrieveContext(userQuery, userId, {
        topK: chatSettings?.topK ?? 5,
        minRelevanceScore: chatSettings?.minRelevanceScore ?? 0.0,
        ragOnlyMode: chatSettings?.ragOnlyMode ?? false,
      })
      : Promise.resolve([]);

    const tabularPromise = decision.useTabular
      ? tabularAgent.retrieveData(userQuery, userId, conversationHistory, model)
      : Promise.resolve(null);

    // OPTIMIZATION: Retrieve memories in parallel with RAG/tabular
    const memoryPromise = retrieveRelevantMemories(userQuery, userId, {
      topK: 3,
      minSimilarity: 0.82,
    }).catch((error) => {
      log.error('Failed to retrieve memories', { error: error instanceof Error ? error.message : String(error), userId });
      return [];
    });

    // Wait for all retrievals to complete in parallel
    const [ragContext, tabularData, memories] = await Promise.all([
      ragPromise,
      tabularPromise,
      memoryPromise,
    ]);

    // Format memory context
    const memoryContext = memories.length > 0 ? formatMemoriesForPrompt(memories) : '';

    log.info('✅ STEP 3: Parallel retrieval complete', {
      userId,
      ragChunks: ragContext.length,
      tabularRows: tabularData?.data?.length || 0,
      memoriesFound: memories.length,
    });

    // Handle tabular clarification if needed
    if (tabularData?.needsClarification) {
      log.info('Tabular agent needs clarification', { userId, clarificationQuestion: tabularData.clarificationQuestion });
      yield {
        content: tabularData.clarificationQuestion || 'Could you please clarify what you\'d like me to find?',
        done: true,
      };
      return;
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
      memoryContext, // OPTIMIZATION: Memory context retrieved in parallel
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
