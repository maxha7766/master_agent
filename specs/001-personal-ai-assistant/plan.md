# Implementation Plan: Personal AI Assistant

**Branch**: `001-personal-ai-assistant` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-personal-ai-assistant/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Building a comprehensive multi-agent conversational AI assistant that enables users to interact with their personal knowledge (documents), databases (SQL), and external research sources through natural language. The system uses a Master Agent for intent classification and routing, with specialized sub-agents (RAG, SQL, Research) handling domain-specific tasks. Core value: Transform unstructured documents and structured databases into conversational interfaces accessible to non-technical users.

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS for backend, Next.js 15 for frontend)
**Primary Dependencies**: Next.js 15 (App Router), Express.js, Supabase (PostgreSQL 15+), Shadcn UI, Tailwind CSS, Zustand, ws (WebSocket), OpenAI SDK, Anthropic SDK, pgvector, pg_trgm
**Storage**: Supabase PostgreSQL 15+ with pgvector extension (vector embeddings), pg_trgm (text search), Row-Level Security (RLS) enabled
**Testing**: Vitest (unit & integration), Playwright (E2E)
**Target Platform**: Web application - Vercel (frontend), Railway (backend), Supabase (database)
**Project Type**: Web (frontend + backend)
**Performance Goals**:
  - Simple chat: <500ms to first token
  - RAG queries: <2 seconds total
  - SQL queries: <3 seconds total
  - Document processing: <10 seconds for 10MB files
  - Research (quick): <2 minutes, (deep): <5 minutes
  - 1000+ concurrent WebSocket connections
**Constraints**:
  - p95 latency <2 seconds for RAG/SQL
  - File upload limit: 100MB (warn but allow)
  - WebSocket rate: 10 messages/second per connection
  - API rate: 100 requests/minute per user
  - LLM API budget: $10 per user per month
  - 99.9% uptime target
**Scale/Scope**:
  - Target: 1000+ concurrent users
  - Storage: 100GB+ documents per user
  - Processing: 1000+ research reports per month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: User-Centric Experience
- ✅ **Response times defined**: <500ms simple chat, <2s RAG, <3s SQL, <2-5min research
- ✅ **Mobile-first**: Next.js 15 + Tailwind CSS + Shadcn UI responsive design
- ✅ **Error handling**: Friendly messages required (FR-052), no stack traces exposed
- ✅ **No manual agent selection**: Master Agent auto-routes (FR-006, FR-007)
- ✅ **Seamless transitions**: Users never see "switching to agent X" messages

### Principle II: Intelligent Architecture
- ✅ **Automatic intent classification**: Master Agent classifies into 5 categories (FR-006)
- ✅ **No manual routing**: System routes automatically (FR-007)
- ✅ **Multi-step handling**: P5 user story covers multi-step workflows
- ✅ **Independent sub-agents**: RAG, SQL, Research agents operate independently with shared context

### Principle III: Data Privacy & Security (NON-NEGOTIABLE)
- ✅ **Row-Level Security**: RLS enforced on ALL tables (FR-048)
- ✅ **Data isolation**: Users can only access their own data (FR-019, SC-008)
- ✅ **File scanning**: Malware scanning before processing (FR-012)
- ✅ **Encryption**: Database credentials encrypted at rest (FR-021), HTTPS only (FR-046)
- ✅ **GDPR compliance**: Hard delete capability (FR-038, SC-015)
- ✅ **Rate limiting**: 100 req/min per user, 10 msg/sec WebSocket (FR-044)
- ✅ **Input sanitization**: XSS and SQL injection prevention (FR-047, SC-012)

### Principle IV: Reliability & Performance
- ✅ **Uptime target**: 99.9% defined (FR-045, SC-007)
- ✅ **Retry logic**: Exponential backoff up to 3 attempts (FR-043)
- ✅ **Graceful degradation**: Error handling for LLM/DB failures defined in edge cases
- ✅ **Background processing**: Research Agent runs async with progress updates (FR-032)
- ✅ **Health checks**: Required every 5 minutes (FR-054)
- ✅ **Performance benchmarks**: All targets defined in Technical Context and success criteria

### Principle V: Extensibility
- ✅ **Modular agents**: Master, RAG, SQL, Research agents independently addable
- ✅ **Plugin architecture**: Research Agent uses SearchProvider interface (FR-029)
- ✅ **Model switching**: User preferences for LLM models (per-agent configuration)
- ✅ **API versioning**: REST + WebSocket protocols (contracts to be defined in Phase 1)
- ✅ **JSONB flexibility**: Flexible data storage for table_data, research_sources

### Principle VI: Code Quality & Testing
- ✅ **TypeScript everywhere**: Frontend and backend use TypeScript
- ✅ **Error handling**: All external calls require try-catch (FR-043)
- ✅ **Structured logging**: All operations log context (FR-053)
- ✅ **Test coverage**: Target 80%+ for critical paths (Vitest for unit/integration)
- ✅ **Test types**: Unit, integration, E2E required (Vitest + Playwright selected in Phase 0)

### Principle VII: Development Velocity
- ✅ **Single environment**: One Supabase project (constitution allows this)
- ✅ **Auto-deployment**: Vercel + Railway auto-deploy on main branch
- ✅ **Hot reload**: Next.js + Express support hot reload
- ✅ **No preview environments**: Manual PR review before merge (constitution compliant)
- ✅ **Migrations**: Supabase CLI for versioned migrations

### Stack Constraints Check
- ✅ **Frontend**: Next.js 15 App Router ✓, Shadcn UI ✓, Tailwind ✓, Zustand ✓, Native WebSocket ✓
- ✅ **Backend**: Node.js 20 LTS ✓, Express.js ✓, ws library ✓, TypeScript ✓
- ✅ **Database**: PostgreSQL 15+ ✓, pgvector ✓, pg_trgm ✓, RLS ✓, JSONB ✓
- ✅ **LLM**: Multi-provider (OpenAI, Anthropic) ✓, per-agent config ✓, streaming ✓, default models (Claude Sonnet 4.5, GPT-4) ✓
- ✅ **Search**: Hybrid search (vector + keyword) ✓, Cohere reranking ✓, Tavily primary/Brave fallback ✓

### Gate Evaluation (Pre-Phase 0)
- ✅ **All principles satisfied** with 1 clarification needed (testing framework)
- ✅ **No stack constraint violations**
- ✅ **No complexity justification required** (using exactly 4 agents as allowed: Master, RAG, SQL, Research)
- ⚠️ **Phase 0 blocker**: Resolve testing framework choice (Jest/Vitest for unit, Playwright/Cypress for E2E)

**STATUS (Pre-Phase 0)**: CONDITIONAL PASS - Proceed to Phase 0 to resolve testing framework clarification

---

### Gate Re-Evaluation (Post-Phase 1)

**All clarifications resolved in Phase 0 (research.md)**

- ✅ **Testing framework**: Vitest (unit/integration) + Playwright (E2E) selected
- ✅ **All principles fully satisfied** with no remaining blockers
- ✅ **No stack constraint violations**
- ✅ **No complexity justification required**
- ✅ **Design artifacts complete**: data-model.md, contracts/, quickstart.md generated

**STATUS (Post-Phase 1)**: FULL PASS - Ready for task generation (/speckit.tasks)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── agents/
│   │   ├── master/           # Intent classification & routing
│   │   ├── rag/              # Document retrieval & question answering
│   │   ├── sql/              # Database schema discovery & query generation
│   │   └── research/         # Multi-source research orchestration
│   ├── services/
│   │   ├── auth/             # Supabase Auth integration
│   │   ├── llm/              # OpenAI & Anthropic SDK wrappers
│   │   ├── embeddings/       # Document chunking & embedding generation
│   │   ├── database/         # SQL connection management & execution
│   │   └── search/           # Search provider plugins (Tavily, Brave, etc.)
│   ├── websocket/
│   │   ├── handlers/         # Message routing & streaming
│   │   └── middleware/       # Auth, rate limiting
│   ├── api/
│   │   ├── routes/           # REST endpoints (upload, connections, etc.)
│   │   └── middleware/       # CORS, JWT validation, logging
│   ├── models/
│   │   └── database.ts       # Supabase client & type definitions
│   └── lib/
│       ├── logger.ts         # Structured logging
│       ├── errors.ts         # Custom error types
│       └── utils.ts          # Shared utilities
└── tests/
    ├── unit/                 # Agent logic, chunking, SQL validation
    ├── integration/          # Document upload flow, RAG search, research pipeline
    └── e2e/                  # Full user journeys (signup → query → results)

frontend/
├── src/
│   ├── app/                  # Next.js 15 App Router pages
│   │   ├── (auth)/           # Login, signup, password reset
│   │   ├── (dashboard)/      # Main chat interface
│   │   └── layout.tsx        # Root layout with providers
│   ├── components/
│   │   ├── ui/               # Shadcn UI components
│   │   ├── chat/             # Message list, input, streaming display
│   │   ├── upload/           # File upload with progress
│   │   └── settings/         # DB connections, LLM model preferences
│   ├── lib/
│   │   ├── websocket.ts      # WebSocket client & message handling
│   │   ├── api.ts            # REST API client
│   │   └── supabase.ts       # Supabase client (auth only)
│   └── store/
│       ├── conversation.ts   # Zustand store for chat state
│       ├── documents.ts      # Uploaded document list
│       └── auth.ts           # User session state
└── tests/
    ├── unit/                 # Component tests, store logic
    └── e2e/                  # Playwright/Cypress full flows

supabase/
├── migrations/               # Versioned SQL migrations
│   └── 001_initial_schema.sql
├── functions/                # Edge functions (if needed for file scanning)
└── seed.sql                  # Development seed data
```

**Structure Decision**: Web application structure (frontend + backend) selected based on Next.js frontend on Vercel and Express.js backend on Railway. Agent-based architecture reflected in `backend/src/agents/` with Master, RAG, SQL, and Research agents as independent modules. Service layer abstracts external dependencies (LLM, embeddings, search providers) for testability and extensibility.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
