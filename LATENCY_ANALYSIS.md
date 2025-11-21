# Latency Analysis & Optimization Recommendations

**Date**: November 20, 2025
**Issue**: User experiencing high latency before responses start streaming

---

## Current Flow Timeline (High-Level)

When a user sends a message, here's what happens **before** streaming starts:

```
User Message Sent
  ↓
1. Database Queries (Parallel) [~50-200ms]
   - Verify conversation exists
   - Fetch user settings (model preference)
  ↓
2. Budget Check [~50-150ms]
   - Query current month's usage
   - Calculate if budget allows
  ↓
3. Save User Message [~30-100ms]
   - INSERT into messages table
  ↓
4. Fetch Conversation History [~50-150ms]
   - SELECT last 20 messages
  ↓
5. Route Message (trivial) [~1-5ms]
   - Fast heuristic routing
  ↓
6. Query Available Documents [~50-200ms]
   - SELECT from documents table
  ↓
7. **CRITICAL BOTTLENECK**: Decide Sub-Agents [~1000-3000ms]
   - **FULL LLM CALL** to Claude/GPT to decide routing
   - Not streaming - waits for complete response
  ↓
8. Retrieve Memories [~200-500ms]
   - Generate embedding for query
   - Vector similarity search
  ↓
9. Finally: Start Streaming Response [✓ User sees first token]
```

**Total Time Before First Token: ~1.5-4 seconds**

---

## Identified Bottlenecks (Ranked by Impact)

### 🔴 CRITICAL: Sub-Agent Decision LLM Call

**Location**: `backend/src/agents/master/orchestrator.ts:433`
**Function**: `decideSubAgents()`
**Impact**: **1-3 seconds**

**Problem**:
```typescript
const decision = await decideSubAgents(userQuery, documents, conversationHistory, model);
```

This makes a **complete, non-streaming LLM call** to decide whether to use RAG, Tabular, or neither. The user waits for this entire decision process before seeing any response.

**Current Implementation**:
- Calls Claude/GPT with full system prompt
- Waits for JSON response with `{"useRAG": true/false, "useTabular": true/false}`
- Blocks all streaming until decision completes

---

### 🟡 MODERATE: Memory Retrieval

**Location**: `backend/src/agents/master/orchestrator.ts:218`
**Function**: `retrieveRelevantMemories()`
**Impact**: **200-500ms**

**Problem**:
- Generates embedding for user query (API call to OpenAI)
- Performs vector similarity search on Supabase
- Currently sequential - happens after routing decision

**Current Flow**:
```typescript
const memories = await retrieveRelevantMemories(userQuery, userId, {
  topK: 3,
  minSimilarity: 0.82,
});
```

---

### 🟢 MINOR: Database Queries

**Location**: `backend/src/websocket/handlers/chatHandler.ts`
**Impact**: **50-200ms each**

**Already Optimized**:
- Lines 61-73: Conversation + Settings queries are already parallelized ✓
- Could parallelize more (see recommendations)

---

## Optimization Recommendations

### Priority 1: Eliminate Sub-Agent Decision LLM Call

**Impact**: **Save 1-3 seconds** (most critical)

**Option A: Rule-Based Routing (Fastest)**

Replace the LLM call with fast heuristics:

```typescript
function decideSubAgentsHeuristic(
  userQuery: string,
  documents: DocumentInfo[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): { useRAG: boolean; useTabular: boolean; reasoning: string } {
  const hasTextDocs = documents.some((d) => !d.isTabular && d.chunk_count);
  const hasTabularDocs = documents.some((d) => d.isTabular);

  const query = userQuery.toLowerCase();

  // Tabular patterns
  const tabularKeywords = /\b(count|how many|sum|average|total|list|show|table|row|column|csv|excel|data|query|filter|sort)\b/i;
  const hasTabularIntent = tabularKeywords.test(query);

  // Follow-up patterns (check recent conversation)
  const followUpPatterns = /\b(them|it|those|that|these|show me|list)\b/i;
  const isFollowUp = followUpPatterns.test(query);
  const recentTabular = conversationHistory.slice(-2).some(msg =>
    msg.role === 'assistant' && /\b(rows?|columns?|table|count)\b/i.test(msg.content)
  );

  // Decide
  const useTabular = hasTabularDocs && (hasTabularIntent || (isFollowUp && recentTabular));
  const useRAG = hasTextDocs && !useTabular; // Use RAG if not tabular and has text docs

  return {
    useRAG,
    useTabular,
    reasoning: useTabular ? 'Tabular pattern detected' : useRAG ? 'Text search' : 'Direct response'
  };
}
```

**Pros**:
- **~1-5ms** instead of 1-3 seconds
- No API cost
- Predictable behavior

**Cons**:
- Less intelligent than LLM
- May occasionally route incorrectly (but can self-correct on follow-up)

---

**Option B: Parallel LLM Routing (Moderate Improvement)**

Start the routing decision in parallel with memory retrieval:

```typescript
// Start both in parallel
const [decision, memories] = await Promise.all([
  decideSubAgents(userQuery, documents, conversationHistory, model),
  retrieveRelevantMemories(userQuery, userId, { topK: 3, minSimilarity: 0.82 })
]);
```

**Pros**:
- Still uses intelligent LLM routing
- Saves 200-500ms by parallelizing memory retrieval

**Cons**:
- Still blocks on LLM call (1-3 seconds)
- Doesn't solve core problem

---

**Option C: Optimistic Streaming (Advanced)**

Start streaming immediately with a "thinking..." state, then route mid-stream:

```typescript
// Start streaming immediately
yield { content: '', metadata: { thinking: true } };

// Route in background
const decision = await decideSubAgents(...);

// Then stream actual response
yield* actualResponse(...);
```

**Pros**:
- User sees instant feedback
- Perceived latency near-zero

**Cons**:
- More complex implementation
- Requires frontend changes

---

### Priority 2: Parallelize More Operations

**Impact**: **Save 200-500ms**

**Current Sequential Flow**:
```typescript
await saveMessage(...);          // ~50ms
const history = await getRecentMessages(...); // ~100ms
const routing = await routeMessage(...);      // ~1ms
const documents = await queryAvailableDocuments(...); // ~100ms
```

**Optimized Parallel Flow**:
```typescript
// Parallelize everything that doesn't depend on each other
const [, history, documents] = await Promise.all([
  saveMessage(...),
  getRecentMessages(...),
  queryAvailableDocuments(userId)
]);

const routing = await routeMessage(...); // Still fast, keep sequential
```

**Location**: `backend/src/websocket/handlers/chatHandler.ts:126-151`

---

### Priority 3: Cache User Settings & Documents

**Impact**: **Save 50-200ms per request**

**Problem**: Every message queries the database for:
- User settings (rarely change)
- Available documents (change only on upload)

**Solution**: In-memory cache with TTL

```typescript
// Simple LRU cache
const settingsCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60_000; // 1 minute

async function getCachedSettings(userId: string) {
  const cached = settingsCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const settings = await fetchSettings(userId);
  settingsCache.set(userId, { data: settings, expires: Date.now() + CACHE_TTL });
  return settings;
}
```

**Invalidation**: Clear cache on settings update or document upload.

---

### Priority 4: Use Faster Embedding Model

**Impact**: **Save 100-300ms**

**Current**: Using OpenAI's `text-embedding-3-small` for memory retrieval
**Problem**: Network round-trip to OpenAI API

**Options**:
1. **Local embedding model** (e.g., `all-MiniLM-L6-v2` via `@xenova/transformers`)
   - 10-50ms instead of 200-400ms
   - No API cost
   - Same quality for short queries

2. **Batch embeddings** (if multiple lookups needed)

---

### Priority 5: Optimize Memory Retrieval Query

**Impact**: **Save 50-100ms**

**Current Query**:
```typescript
const { data: memories } = await supabase
  .from('user_memories')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true);

// Then calculate similarity in-memory
```

**Problem**: Fetches all memories, calculates similarity client-side.

**Optimized**: Use Supabase's pgvector for server-side similarity:

```typescript
const { data: memories } = await supabase.rpc('match_memories', {
  query_embedding: embedding,
  match_threshold: 0.82,
  match_count: 3,
  user_id: userId
});
```

**SQL Function**:
```sql
CREATE FUNCTION match_memories(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (id uuid, content text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    1 - (m.embedding <=> query_embedding) as similarity
  FROM user_memories m
  WHERE m.user_id = user_id
    AND m.is_active = true
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 hours)
1. ✅ **Replace LLM routing with heuristics** (Priority 1, Option A)
   - Saves 1-3 seconds
   - Minimal risk
   - Easy to revert if needed

2. ✅ **Parallelize database operations** (Priority 2)
   - Saves 200-500ms
   - No breaking changes

**Expected Improvement**: **1.5-3.5 seconds faster** → **~500ms-1s before first token**

---

### Phase 2: Medium-Term (4-6 hours)
3. ✅ **Add caching for settings/documents** (Priority 3)
   - Saves 50-200ms
   - Requires cache invalidation logic

4. ✅ **Optimize memory query with pgvector** (Priority 5)
   - Saves 50-100ms
   - Requires SQL migration

**Expected Improvement**: **Additional 100-300ms faster** → **~200ms-700ms before first token**

---

### Phase 3: Advanced (8-12 hours)
5. ⚠️ **Local embedding model** (Priority 4)
   - Saves 100-300ms
   - Requires testing embedding quality
   - May need model download/hosting

6. ⚠️ **Optimistic streaming** (Priority 1, Option C)
   - Near-zero perceived latency
   - Requires frontend changes

**Expected Improvement**: **Additional 100-300ms faster** → **~100ms-400ms before first token**

---

## Expected Results Summary

| Phase | Changes | Time Before First Token | Improvement |
|-------|---------|-------------------------|-------------|
| **Current** | None | 1.5-4 seconds | - |
| **Phase 1** | Heuristic routing + parallelization | 0.5-1 second | **66-75% faster** |
| **Phase 2** | + Caching + pgvector | 0.2-0.7 seconds | **85-95% faster** |
| **Phase 3** | + Local embeddings + optimistic | 0.1-0.4 seconds | **90-97% faster** |

---

## Code Locations to Modify

### Priority 1: Replace LLM Routing
- **File**: `backend/src/agents/master/orchestrator.ts`
- **Line**: 62-176 (entire `decideSubAgents` function)
- **Action**: Replace with heuristic version (see Option A above)

### Priority 2: Parallelize Operations
- **File**: `backend/src/websocket/handlers/chatHandler.ts`
- **Lines**: 126-151
- **Action**: Wrap in `Promise.all()`

### Priority 3: Add Caching
- **File**: Create `backend/src/services/cache/settingsCache.ts`
- **Action**: Implement LRU cache with TTL

### Priority 4: Local Embeddings
- **File**: `backend/src/services/embeddings/index.ts`
- **Action**: Add local model option

### Priority 5: pgvector Query
- **File**: `backend/supabase/migrations/` (new migration)
- **File**: `backend/src/services/memory/memoryManager.ts:115`
- **Action**: Replace client-side similarity with RPC call

---

## Testing Checklist

After implementing optimizations:

- [ ] Test simple greeting ("hi") - should be <500ms
- [ ] Test tabular query - routing should still work
- [ ] Test RAG query - semantic search should still work
- [ ] Test follow-up query - context awareness should still work
- [ ] Monitor logs for any routing mistakes
- [ ] Check memory retrieval quality (similarity scores)
- [ ] Verify cache invalidation on settings change
- [ ] Load test with concurrent users

---

## Risk Assessment

| Optimization | Risk Level | Rollback Difficulty |
|--------------|------------|---------------------|
| Heuristic routing | 🟡 Medium | Easy (git revert) |
| Parallelization | 🟢 Low | Easy |
| Caching | 🟡 Medium | Easy (disable cache) |
| pgvector query | 🟢 Low | Medium (migration) |
| Local embeddings | 🟡 Medium | Medium (quality risk) |
| Optimistic streaming | 🔴 High | Hard (frontend changes) |

---

## Monitoring Recommendations

Add timing logs to track improvements:

```typescript
const timings = {
  start: Date.now(),
  afterDbQueries: 0,
  afterRouting: 0,
  afterMemories: 0,
  firstToken: 0
};

// After each phase
timings.afterDbQueries = Date.now() - timings.start;
log.info('Latency timing', { phase: 'db_queries', ms: timings.afterDbQueries });
```

Track in dashboard:
- P50/P95/P99 time to first token
- Routing accuracy (heuristic vs LLM baseline)
- Cache hit rate
- Memory retrieval quality

---

## Conclusion

**Most Critical Fix**: Replace the `decideSubAgents()` LLM call with heuristic routing. This single change will reduce latency by **66-75%** with minimal risk.

**Quick Implementation**: Phase 1 can be completed in 1-2 hours and will provide the most noticeable improvement to users.

**Next Steps**:
1. Implement heuristic routing (Priority 1, Option A)
2. Test thoroughly with various query types
3. Monitor routing accuracy
4. If accuracy is acceptable, move to Phase 2
5. If accuracy is poor, fall back to Option B (parallel routing)
