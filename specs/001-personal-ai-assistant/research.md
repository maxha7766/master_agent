# Research: Personal AI Assistant

**Feature**: 001-personal-ai-assistant
**Date**: 2025-10-27
**Phase**: 0 (Outline & Research)

## Purpose

This document consolidates research findings for technical decisions and clarifications needed during implementation planning.

## Research Tasks

### 1. Testing Framework Selection for TypeScript Web Application

**Context**: Need to select testing frameworks for unit, integration, and E2E tests across Next.js 15 frontend and Express.js backend.

**Decision**:
- **Unit & Integration Tests**: Vitest
- **E2E Tests**: Playwright

**Rationale**:

**Vitest** (Unit & Integration):
- Native TypeScript and ES Modules support (critical for Next.js 15 App Router)
- Compatible with both frontend (React components) and backend (Node.js)
- Faster than Jest (~10x speed improvement for large test suites)
- Built-in code coverage with c8
- Compatible with Vite ecosystem (though not required for Next.js)
- Can use @testing-library/react for component tests
- Unified configuration for both frontend and backend tests

**Playwright** (E2E):
- Better performance than Cypress for multi-page flows
- Built-in support for multiple browsers (Chromium, Firefox, WebKit)
- Native WebSocket testing capabilities (critical for real-time chat)
- Better parallelization and sharding for CI/CD
- Auto-wait and retry mechanisms reduce flakiness
- Can test auth flows with Supabase without complex mocking
- Official Next.js support and documentation

**Alternatives Considered**:

1. **Jest** (rejected):
   - Slower than Vitest
   - More complex TypeScript/ESM configuration
   - Requires additional setup for Next.js 15 App Router
   - Still viable but Vitest offers better DX

2. **Cypress** (rejected for E2E):
   - Slower test execution than Playwright
   - More difficult WebSocket testing
   - Limited multi-browser support in free tier
   - Playwright has better debugging tools

### 2. Document Chunking Strategy for RAG

**Context**: Need to determine optimal chunking approach for PDF, DOCX, TXT, CSV, XLSX, MD files to balance retrieval precision and context preservation.

**Decision**: Hybrid chunking strategy with semantic boundaries

**Approach**:
```typescript
// Chunking configuration
const CHUNK_CONFIG = {
  targetSize: 800,        // Target tokens per chunk
  minSize: 500,           // Minimum tokens
  maxSize: 1200,          // Maximum tokens
  overlap: 100,           // Token overlap between chunks
  respectBoundaries: true // Prefer sentence/paragraph breaks
}
```

**Rationale**:
- **500-1200 token range**: Fits within most LLM context windows while providing sufficient context
- **Semantic boundaries**: Prevents splitting mid-sentence, improves retrieval quality
- **100 token overlap**: Ensures context continuity across chunk boundaries
- **800 token target**: Balances precision (smaller chunks = better matching) with context (larger chunks = more information)

**Library**: `langchain` Document splitters (RecursiveCharacterTextSplitter) for text formats, `pdf-parse` for PDFs, `mammoth` for DOCX, `xlsx` for spreadsheets

**Alternatives Considered**:
1. **Fixed 512 tokens** (rejected): Too rigid, splits mid-sentence frequently
2. **Paragraph-based only** (rejected): Paragraphs vary too much in size (10-2000+ tokens)
3. **No overlap** (rejected): Loses context at chunk boundaries

### 3. Hybrid Search Implementation (Vector + Keyword)

**Context**: RAG Agent requires hybrid search combining vector similarity and keyword matching (BM25).

**Decision**: PostgreSQL native hybrid search with pgvector + pg_trgm

**Implementation**:
```sql
-- Hybrid search query combining vector similarity and keyword matching
SELECT
  c.id,
  c.content,
  c.metadata,
  (
    (1 - (c.embedding <=> query_embedding)) * 0.7 +  -- Vector similarity (70% weight)
    ts_rank(c.content_tsv, to_tsquery('english', query_text)) * 0.3  -- Keyword relevance (30% weight)
  ) AS hybrid_score
FROM chunks c
WHERE
  c.user_id = $1  -- RLS enforcement
  AND (
    c.embedding <=> query_embedding < 0.5  -- Vector distance threshold
    OR c.content_tsv @@ to_tsquery('english', query_text)  -- Keyword match
  )
ORDER BY hybrid_score DESC
LIMIT 10;
```

**Rationale**:
- **Avoids external dependencies**: No need for Elasticsearch or separate search service
- **70/30 weighting**: Vector search handles semantic queries, keyword search catches exact matches
- **pg_trgm trigram index**: Fast fuzzy text search for typos and partial matches
- **PostgreSQL full-text search**: Built-in stemming and ranking
- **RLS compatible**: User isolation enforced at database level

**Alternatives Considered**:
1. **Pinecone/Weaviate** (rejected): Additional cost, complexity, and data sync overhead
2. **Pure vector search** (rejected): Misses exact keyword matches (e.g., product codes, names)
3. **Pure keyword search** (rejected): Misses semantic similarity (e.g., "automobile" vs "car")

### 4. Cohere Reranking Integration

**Context**: FR-017 requires Cohere reranking to improve retrieval precision.

**Decision**: Use Cohere Rerank API as post-processing step after hybrid search

**Implementation Flow**:
1. Hybrid search returns top 20 candidates
2. Send candidates + user query to Cohere Rerank API
3. Rerank API returns relevance scores (0-1)
4. Select top 5 reranked results for LLM context
5. Fallback to hybrid search scores if Cohere API fails

**Rationale**:
- **Cohere specialization**: Purpose-built reranking models outperform generic embeddings
- **Cost-effective**: Only rerank top candidates (20 chunks), not entire corpus
- **Graceful degradation**: Falls back to hybrid scores if API unavailable
- **Simple integration**: Single API call, no model hosting required

**Cost Estimate**: $0.002 per 1000 rerank calls (20 chunks each) = negligible for <10k daily queries

**Alternatives Considered**:
1. **Self-hosted reranking model** (rejected): Adds infrastructure complexity, slower
2. **Skip reranking** (rejected): Violates FR-017, measurably worse retrieval quality
3. **OpenAI embeddings reranking** (rejected): Not specialized for reranking task

### 5. SQL Query Validation & Safety

**Context**: FR-024 requires validation to prevent DROP, DELETE, UPDATE operations (read-only by default).

**Decision**: Multi-layer SQL validation using AST parsing + database permissions

**Validation Layers**:

```typescript
// Layer 1: AST parsing (detect forbidden operations)
import { parse } from 'pgsql-ast-parser';

function validateSQL(sql: string): { valid: boolean; error?: string } {
  try {
    const ast = parse(sql);
    const forbiddenTypes = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];

    for (const statement of ast) {
      if (forbiddenTypes.includes(statement.type.toLowerCase())) {
        return { valid: false, error: `Forbidden operation: ${statement.type}` };
      }
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid SQL syntax' };
  }
}

// Layer 2: Database user with SELECT-only permissions
const DB_USER_PERMISSIONS = {
  grant: ['SELECT'],  // Only SELECT allowed
  revoke: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE']
};

// Layer 3: Query timeout (5 seconds default)
const queryOptions = {
  statement_timeout: 5000,  // Milliseconds
  max_rows: 1000            // Row limit
};
```

**Rationale**:
- **AST parsing**: Catches forbidden operations before execution
- **Database permissions**: Defense-in-depth if AST parsing bypassed
- **Timeouts**: Prevents long-running queries from blocking resources
- **Row limits**: Prevents massive result sets from overwhelming frontend

**Alternatives Considered**:
1. **Regex-based validation** (rejected): Easily bypassed with SQL injection tricks
2. **LLM-based validation** (rejected): Too slow, not 100% reliable for security
3. **Allow all operations with confirmation** (rejected): Too risky, violates FR-024

### 6. Research Agent Search Provider Plugin Architecture

**Context**: FR-029 requires plugin architecture for multiple search providers (Tavily, Brave, Firecrawl, Semantic Scholar, arXiv, PubMed, GitHub).

**Decision**: Interface-based plugin system with provider registry

**Interface**:
```typescript
interface SearchProvider {
  name: string;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  validateSource(result: SearchResult): Promise<CredibilityScore>;
  priority: number;  // Lower = higher priority
}

interface SearchOptions {
  maxResults: number;
  depth: 'quick' | 'standard' | 'deep';
  domains?: string[];  // Whitelist/blacklist
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  publishDate?: Date;
  author?: string;
  domain: string;
}

interface CredibilityScore {
  score: number;  // 0-100
  factors: {
    domainReputation: number;
    recency: number;
    authorCredentials?: number;
  };
}
```

**Provider Registry**:
```typescript
class SearchProviderRegistry {
  private providers: Map<string, SearchProvider> = new Map();

  register(provider: SearchProvider) {
    this.providers.set(provider.name, provider);
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const sortedProviders = Array.from(this.providers.values())
      .sort((a, b) => a.priority - b.priority);

    const results: SearchResult[] = [];

    for (const provider of sortedProviders) {
      try {
        const providerResults = await provider.search(query, options);
        results.push(...providerResults);

        if (results.length >= options.maxResults) break;
      } catch (error) {
        console.warn(`Provider ${provider.name} failed`, error);
        // Continue to next provider (graceful degradation)
      }
    }

    return results;
  }
}
```

**Rationale**:
- **Extensibility**: Add new providers by implementing SearchProvider interface
- **Graceful degradation**: If one provider fails, try next in priority order
- **Unified interface**: Research Agent doesn't need to know provider-specific details
- **Credibility scoring**: Standardized quality assessment across providers

**Alternatives Considered**:
1. **Hard-coded provider logic** (rejected): Not extensible, violates Principle V
2. **Dynamic plugin loading** (rejected): Overkill for TypeScript project, security risk
3. **Single provider** (rejected): Single point of failure, violates FR-029

### 7. WebSocket Message Protocol Design

**Context**: Need to define message format for real-time communication between frontend and backend for streaming responses, progress updates, and multi-step workflows.

**Decision**: JSON-based message protocol with typed message kinds

**Protocol**:
```typescript
// Client → Server messages
type ClientMessage =
  | { kind: 'chat', conversationId: string, content: string }
  | { kind: 'upload', fileName: string, fileData: string }  // Base64
  | { kind: 'cancel', jobId: string };

// Server → Client messages
type ServerMessage =
  | { kind: 'stream_start', messageId: string, agent: string }
  | { kind: 'stream_chunk', messageId: string, chunk: string }
  | { kind: 'stream_end', messageId: string, metadata: MessageMetadata }
  | { kind: 'progress', jobId: string, percent: number, status: string }
  | { kind: 'error', error: string, code: string }
  | { kind: 'citation', messageId: string, source: Source };

interface MessageMetadata {
  tokensUsed: number;
  latencyMs: number;
  agentUsed: string;
  model: string;
}
```

**Rationale**:
- **Typed messages**: TypeScript discriminated unions for type safety
- **Streaming support**: Start/chunk/end pattern for LLM streaming
- **Progress tracking**: Research jobs can report progress percentage
- **Citation delivery**: RAG Agent can send sources separately from main response
- **Error handling**: Standardized error format with codes for client handling

**Alternatives Considered**:
1. **Socket.io** (rejected): Constitution forbids Socket.io (requires `ws` library)
2. **GraphQL subscriptions** (rejected): Adds complexity, WebSocket sufficient
3. **Server-Sent Events (SSE)** (rejected): Unidirectional, can't send client messages

## Summary of Resolved Clarifications

| Original Clarification | Resolution |
|------------------------|------------|
| Testing framework (Jest/Vitest, Playwright/Cypress) | Vitest for unit/integration, Playwright for E2E |

## Best Practices & Patterns

### Error Handling Pattern

```typescript
// Standardized error handling for all external calls
async function callExternalService<T>(
  fn: () => Promise<T>,
  serviceName: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      logger.warn({
        service: serviceName,
        attempt,
        maxRetries,
        error: lastError.message
      });

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;  // Exponential backoff
        await sleep(backoffMs);
      }
    }
  }

  throw new ExternalServiceError(
    `${serviceName} failed after ${maxRetries} attempts`,
    { cause: lastError }
  );
}
```

### Structured Logging Pattern

```typescript
// Context-aware logging for all operations
interface LogContext {
  userId: string;
  conversationId?: string;
  messageId?: string;
  agentUsed?: string;
  modelUsed?: string;
  responseTime?: number;
  tokenCount?: number;
}

logger.info({
  event: 'rag_query_complete',
  ...context,
  chunksRetrieved: 5,
  cohereRerankScore: 0.87,
  responseTime: 1823
});
```

### Authentication Middleware Pattern

```typescript
// JWT validation for all protected routes
async function authenticateRequest(req: Request): Promise<User> {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedError('Invalid token');
    }

    return user;
  } catch (error) {
    logger.error({ event: 'auth_failure', error });
    throw new UnauthorizedError('Authentication failed');
  }
}
```

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend Framework | Next.js | 15 (App Router) | React framework with SSR/SSG |
| Frontend UI | Shadcn UI + Tailwind CSS | Latest | Component library + styling |
| Frontend State | Zustand | Latest | Lightweight state management |
| Frontend WebSocket | Native WebSocket API | - | Real-time communication |
| Backend Runtime | Node.js | 20 LTS | JavaScript runtime |
| Backend Framework | Express.js | Latest | HTTP server & middleware |
| Backend WebSocket | ws | Latest | WebSocket server |
| Database | PostgreSQL (Supabase) | 15+ | Relational database |
| Vector Search | pgvector | 0.5+ | Embedding storage & similarity search |
| Text Search | pg_trgm | - | Trigram-based fuzzy search |
| Authentication | Supabase Auth | Latest | JWT-based authentication |
| LLM Providers | OpenAI SDK, Anthropic SDK | Latest | GPT-4/5, Claude Sonnet/Opus |
| Embeddings | OpenAI text-embedding-3-large | - | Document embeddings |
| Reranking | Cohere Rerank API | - | Search result reranking |
| Search Providers | Tavily, Brave, Firecrawl | - | Web search |
| Academic Search | Semantic Scholar, arXiv, PubMed | - | Research papers |
| Code Search | GitHub API | - | Repository search |
| Testing (Unit/Integration) | Vitest | Latest | Fast TypeScript test runner |
| Testing (E2E) | Playwright | Latest | Browser automation |
| Testing (Component) | @testing-library/react | Latest | React component testing |
| Deployment (Frontend) | Vercel | - | Serverless Next.js hosting |
| Deployment (Backend) | Railway | - | Container-based Node.js hosting |
| Deployment (Database) | Supabase | - | Managed PostgreSQL |

### 8. LLM API Cost Budget Management

**Context**: Need to prevent runaway API costs while allowing reasonable usage. Clarified during `/speckit.clarify`: $10 per user per month budget limit.

**Decision**: Proactive monitoring with graceful degradation at budget threshold

**Implementation Strategy**:

```typescript
// Track usage per user per month
interface UserUsage {
  userId: string;
  month: string;  // YYYY-MM format
  totalCost: number;
  tokensByModel: {
    [model: string]: {
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };
  };
  lastUpdated: Date;
}

// Budget enforcement
const MONTHLY_BUDGET_USD = 10.00;
const WARNING_THRESHOLD = 0.80;  // Warn at 80%

async function checkBudgetBeforeRequest(
  userId: string,
  estimatedTokens: number,
  model: string
): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getUserMonthlyUsage(userId);
  const estimatedCost = calculateCost(estimatedTokens, model);

  if (usage.totalCost + estimatedCost > MONTHLY_BUDGET_USD) {
    return {
      allowed: false,
      reason: 'Monthly budget limit reached ($10/month). Resets on 1st of next month.'
    };
  }

  if (usage.totalCost + estimatedCost > MONTHLY_BUDGET_USD * WARNING_THRESHOLD) {
    // Warn but allow
    sendBudgetWarning(userId, usage.totalCost, MONTHLY_BUDGET_USD);
  }

  return { allowed: true };
}
```

**Graceful Degradation Options**:
1. **Cached responses**: Check if similar query answered recently, return cached response
2. **Reduced context**: Use fewer messages in context window (10 instead of 20)
3. **Smaller models**: Switch from GPT-4 to GPT-3.5-turbo or Claude Sonnet to Haiku
4. **Pause features**: Disable research agent (highest cost), allow basic chat and RAG only
5. **Usage dashboard**: Show user their usage, allow them to prioritize features

**Cost Estimation**:
- GPT-4: $0.03/1K input tokens, $0.06/1K output tokens
- Claude Sonnet 4.5: $0.003/1K input, $0.015/1K output
- GPT-3.5-turbo: $0.0005/1K input, $0.0015/1K output

**Average usage projection**:
- Basic chat (20 msg history, 500 tokens avg): ~$0.03/query with GPT-4
- RAG query (20 msg + 5 chunks, 2K tokens): ~$0.12/query with Claude Sonnet
- SQL query (schema + query, 1.5K tokens): ~$0.09/query with GPT-4
- Research (deep, 10K tokens): ~$1.50/report with Claude Sonnet

$10/month allows approximately:
- 300 basic chat queries
- 80 RAG queries
- 110 SQL queries
- 6-7 deep research reports
- Or mixed usage totaling similar cost

**Rationale**:
- **Prevents abuse**: Hard cap prevents malicious or accidental runaway costs
- **User transparency**: Dashboard shows usage and remaining budget
- **Graceful degradation**: System remains usable even at budget limit
- **Reasonable limit**: $10 allows extensive normal usage (~500K tokens)
- **Reset cycle**: Monthly reset prevents long-term lockout

**Alternatives Considered**:
1. **No limit** (rejected): Risk of runaway costs, abuse potential
2. **Per-request limit** (rejected): Too granular, annoying UX, doesn't prevent daily abuse
3. **Tiered pricing** (rejected): Adds complexity, out of scope for MVP
4. **Pay-per-use** (rejected): Requires payment processing, billing infrastructure

## Phase 0 Completion Checklist

- ✅ Testing framework selected (Vitest + Playwright)
- ✅ Document chunking strategy defined
- ✅ Hybrid search implementation approach documented
- ✅ Cohere reranking integration planned
- ✅ SQL validation layers designed
- ✅ Search provider plugin architecture defined
- ✅ WebSocket message protocol specified
- ✅ Error handling pattern established
- ✅ Logging pattern established
- ✅ Authentication pattern established
- ✅ LLM API cost budget management strategy defined ($10/user/month)
- ✅ Technology stack finalized

**Status**: Phase 0 complete. All NEEDS CLARIFICATION items resolved. Ready for Phase 1 (Design & Contracts).
