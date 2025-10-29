# Tasks: Personal AI Assistant

**Input**: Design documents from `/specs/001-personal-ai-assistant/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`, `supabase/`
- Paths below follow the project structure defined in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 ✅ Create backend directory structure with src/, tests/, package.json
- [x] T002 ✅ Initialize backend TypeScript project with Express.js dependencies (express, @types/express, ws, @types/ws, typescript, ts-node-dev)
- [x] T003 ✅ Create frontend directory structure with src/, package.json using Next.js 15 App Router
- [x] T004 ✅ Initialize frontend Next.js 15 project with Tailwind CSS and Shadcn UI dependencies (includes Zustand, @supabase/supabase-js)
- [x] T005 ✅ Create supabase directory structure with migrations/, functions/, seed.sql
- [x] T006 ✅ Initialize Supabase project locally using supabase init
- [x] T007 [P] ✅ Configure TypeScript config for backend in backend/tsconfig.json (strict mode, ES2022, node resolution)
- [x] T008 [P] ✅ Configure TypeScript config for frontend in frontend/tsconfig.json (strict mode, Next.js paths)
- [x] T009 [P] ✅ Configure ESLint and Prettier for backend in backend/.eslintrc.json and .prettierrc
- [x] T010 [P] ✅ Configure ESLint and Prettier for frontend in eslint.config.mjs and .prettierrc
- [x] T011 [P] ✅ Backend environment configuration created in .env and .env.example at project root with all API keys (Supabase, OpenAI, Anthropic, Gemini, Tavily, Brave, Firecrawl, Context7, NewsAPI, LangSmith, GitHub)
- [x] T012 [P] ✅ Create frontend environment template in frontend/.env.local with NEXT_PUBLIC_ prefixed variables (Supabase anon key, backend API/WS URLs)
- [x] T013 [P] ✅ Set up Vitest configuration for backend in backend/vitest.config.ts
- [x] T014 [P] ✅ Set up Vitest configuration for frontend in frontend/vitest.config.ts (includes @testing-library/react, jsdom)
- [x] T015 [P] ✅ Set up Playwright configuration for E2E tests in playwright.config.ts at project root

**Checkpoint**: Project structure created, dependencies installed, configuration files in place

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Foundation

- [x] T016 ✅ Create initial database migration in supabase/migrations/20251027000000_initial_schema.sql with all tables
- [x] T017 ✅ Create user_settings table with RLS policies in migration file
- [x] T018 ✅ Create user_usage table for budget tracking with RLS policies in migration file
- [x] T019 ✅ Create conversations and messages tables with RLS policies in migration file
- [x] T020 ✅ Create documents and chunks tables with pgvector extension and RLS policies in migration file
- [x] T021 ✅ Create database_connections table with RLS policies in migration file
- [x] T022 ✅ Create research_reports and search_sources tables with RLS policies in migration file
- [x] T023 ✅ Create indexes for vector search (ivfflat), full-text (GIN), and foreign keys in migration file
- [x] T024 ✅ Create check_user_budget function in migration file for budget enforcement
- [ ] T025 ⚠️ Apply migration using `supabase db reset` (requires Docker/Supabase running locally)

### Backend Core Services

- [x] T026 ✅ Create Supabase client singleton in backend/src/models/database.ts with service role key
- [x] T027 ✅ Generate TypeScript types in backend/src/models/database.types.ts (all 9 tables with Row/Insert/Update types)
- [x] T028 [P] ✅ Create structured logger utility in backend/src/lib/logger.ts using winston with JSON formatting
- [x] T029 [P] ✅ Create custom error types in backend/src/lib/errors.ts (UnauthorizedError, ValidationError, ExternalServiceError, BudgetExceededError, etc.)
- [x] T030 [P] ✅ Create shared utilities in backend/src/lib/utils.ts (sleep, retry with exponential backoff, token counting, LLM cost calculation)

### LLM Service Foundation

- [x] T031 ✅ Create LLM provider interface in backend/src/services/llm/provider.ts with methods for chat, streaming, tokenCount
- [x] T032 [P] ✅ Implement OpenAI provider in backend/src/services/llm/openai.ts supporting GPT-4 and GPT-3.5-turbo
- [x] T033 [P] ✅ Implement Anthropic provider in backend/src/services/llm/anthropic.ts supporting Claude Sonnet 4.5 and Haiku
- [x] T034 ✅ Create LLM service factory in backend/src/services/llm/factory.ts to select provider based on model name
- [x] T035 ✅ Create budget tracking service in backend/src/services/llm/budget.ts to check and update user_usage before LLM calls

### Authentication Middleware

- [x] T036 ✅ Create JWT validation middleware in backend/src/api/middleware/auth.ts using Supabase Auth
- [x] T037 [P] ✅ Create CORS middleware in backend/src/api/middleware/cors.ts restricted to frontend domain
- [x] T038 [P] ✅ Create rate limiting middleware in backend/src/api/middleware/rateLimit.ts (100 req/min per user)
- [x] T039 [P] ✅ Create request logging middleware in backend/src/api/middleware/logging.ts with structured logs

### WebSocket Foundation

- [x] T040 ✅ Create WebSocket server setup in backend/src/websocket/server.ts using ws library
- [x] T041 ✅ Create WebSocket authentication middleware in backend/src/websocket/middleware/auth.ts to validate JWT on connection
- [x] T042 ✅ Create WebSocket rate limiting middleware in backend/src/websocket/middleware/rateLimit.ts (10 msg/sec per connection)
- [x] T043 ✅ Create WebSocket message type definitions in backend/src/websocket/types.ts based on websocket-protocol.md
- [x] T044 ✅ Create WebSocket message router in backend/src/websocket/router.ts to route messages by kind

### Frontend Core

- [x] T045 ✅ Create Supabase client for frontend in frontend/lib/supabase.ts (auth only, using anon key)
- [x] T046 [P] ✅ Create REST API client in frontend/lib/api.ts with fetch, including auth headers
- [x] T047 ✅ Create WebSocket client in frontend/lib/websocket.ts with reconnection logic and message handling
- [x] T048 ✅ Create auth Zustand store in frontend/store/auth.ts for user session state
- [x] T049 [P] ✅ Create conversation Zustand store in frontend/store/conversation.ts for chat state
- [x] T050 [P] ✅ Create documents Zustand store in frontend/store/documents.ts for uploaded document list
- [x] T051 ✅ Create root layout in frontend/app/layout.tsx with providers (Zustand, theme)
- [x] T052 ✅ Install and configure Shadcn UI components needed: Button, Input, Card, Dialog, Progress, Tabs, Sonner

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Chat & Authentication (Priority: P1) 🎯 MVP

**Goal**: Users can sign up, log in, and have basic conversational interactions with the AI assistant

**Independent Test**: User can sign up with email/password, log in, send "What's the weather like today?", receive conversational response within 2 seconds. Session persists across page refresh.

### Backend Implementation for US1

- [ ] T053 [P] [US1] Create User entity types in backend/src/models/database.types.ts (if not auto-generated)
- [ ] T054 [P] [US1] Create Conversation and Message entity types in backend/src/models/database.types.ts
- [ ] T055 [US1] Create auth service in backend/src/services/auth/authService.ts with signup, login, logout methods using Supabase Auth
- [ ] T056 [US1] Create conversation service in backend/src/services/conversation/conversationService.ts with createConversation, getConversations, getMessages methods
- [ ] T057 [US1] Create Master Agent intent classifier in backend/src/agents/master/intentClassifier.ts to classify into 5 categories (general_chat, rag_query, sql_query, research_request, multi_step_workflow)
- [ ] T058 [US1] Create Master Agent router in backend/src/agents/master/router.ts to route requests to sub-agents based on intent
- [ ] T059 [US1] Create Master Agent direct responder in backend/src/agents/master/directResponder.ts for handling general_chat using LLM with 20 message context window
- [ ] T060 [US1] Create WebSocket chat handler in backend/src/websocket/handlers/chatHandler.ts to process incoming chat messages, call Master Agent, stream responses
- [ ] T061 [US1] Create POST /api/auth/signup endpoint in backend/src/api/routes/auth.ts for user registration
- [ ] T062 [US1] Create POST /api/auth/login endpoint in backend/src/api/routes/auth.ts for authentication
- [ ] T063 [US1] Create POST /api/auth/logout endpoint in backend/src/api/routes/auth.ts for session invalidation
- [ ] T064 [US1] Create GET /api/conversations endpoint in backend/src/api/routes/conversations.ts to list user's conversations
- [ ] T065 [US1] Create POST /api/conversations endpoint in backend/src/api/routes/conversations.ts to create new conversation
- [ ] T066 [US1] Create GET /api/conversations/:id endpoint in backend/src/api/routes/conversations.ts to get conversation with messages
- [ ] T067 [US1] Create Express app entry point in backend/src/index.ts with all middleware, routes, WebSocket server initialization
- [ ] T068 [US1] Add error handling for LLM API failures with exponential backoff (3 retries) in direct responder
- [ ] T069 [US1] Add budget checking before Master Agent LLM calls, graceful degradation if budget exceeded

### Frontend Implementation for US1

- [ ] T070 [P] [US1] Create auth pages in frontend/src/app/(auth)/login/page.tsx for login form
- [ ] T071 [P] [US1] Create signup page in frontend/src/app/(auth)/signup/page.tsx for registration form
- [ ] T072 [P] [US1] Create password reset page in frontend/src/app/(auth)/reset/page.tsx for password recovery
- [ ] T073 [US1] Create main dashboard layout in frontend/src/app/(dashboard)/layout.tsx with navigation
- [ ] T074 [US1] Create chat page in frontend/src/app/(dashboard)/page.tsx as main interface
- [ ] T075 [P] [US1] Create MessageList component in frontend/src/components/chat/MessageList.tsx to display conversation history
- [ ] T076 [P] [US1] Create MessageInput component in frontend/src/components/chat/MessageInput.tsx with send functionality
- [ ] T077 [P] [US1] Create StreamingMessage component in frontend/src/components/chat/StreamingMessage.tsx to show typing indicator and incremental tokens
- [ ] T078 [US1] Create ConversationSidebar component in frontend/src/components/chat/ConversationSidebar.tsx to list conversations
- [ ] T079 [US1] Wire up WebSocket connection in chat page to send/receive messages
- [ ] T080 [US1] Implement message streaming display in StreamingMessage component handling stream_start, stream_chunk, stream_end messages
- [ ] T081 [US1] Add session persistence using Supabase Auth state management with automatic token refresh
- [ ] T082 [US1] Add error handling UI for chat failures (network errors, LLM failures, budget exceeded) with friendly messages

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can sign up, log in, chat, and have sessions persist.

---

## Phase 4: User Story 2 - Document Upload & RAG Queries (Priority: P2)

**Goal**: Users can upload documents and ask questions about their content using natural language with cited answers

**Independent Test**: User uploads 5-page PDF, asks "What are the main findings?", receives accurate answer with page references within 2 seconds

### Backend Implementation for US2

- [ ] T083 [P] [US2] Create Document and Chunk entity types in backend/src/models/database.types.ts (if not generated)
- [ ] T084 [US2] Create document parser service in backend/src/services/embeddings/parser.ts supporting PDF, TXT, DOCX, CSV, XLSX, MD formats using pdf-parse, mammoth, xlsx libraries
- [ ] T085 [US2] Create document chunker in backend/src/services/embeddings/chunker.ts with semantic boundary detection (500-1000 tokens, 100 token overlap)
- [ ] T086 [US2] Create embedding service in backend/src/services/embeddings/embeddingService.ts using OpenAI text-embedding-3-large
- [ ] T087 [US2] Create file virus scanner wrapper in backend/src/services/embeddings/virusScanner.ts (integrate ClamAV or similar, or placeholder for now)
- [ ] T088 [US2] Create document upload pipeline in backend/src/services/embeddings/uploadPipeline.ts orchestrating scan → parse → chunk → embed → store
- [ ] T089 [US2] Create RAG Agent search service in backend/src/agents/rag/searchService.ts implementing hybrid search (vector + keyword BM25) using pgvector and pg_trgm
- [ ] T090 [US2] Create Cohere reranking integration in backend/src/agents/rag/reranker.ts to rerank top 20 chunks to top 5
- [ ] T091 [US2] Create RAG Agent responder in backend/src/agents/rag/responder.ts to retrieve chunks, rerank, generate answer with citations using LLM
- [ ] T092 [US2] Create POST /api/documents endpoint in backend/src/api/routes/documents.ts for file upload (multipart/form-data)
- [ ] T093 [US2] Create GET /api/documents endpoint in backend/src/api/routes/documents.ts to list user's documents
- [ ] T094 [US2] Create GET /api/documents/:id endpoint in backend/src/api/routes/documents.ts to get document details
- [ ] T095 [US2] Create DELETE /api/documents/:id endpoint in backend/src/api/routes/documents.ts to delete document and chunks
- [ ] T096 [US2] Update Master Agent router to detect rag_query intent and route to RAG Agent
- [ ] T097 [US2] Update WebSocket chat handler to support citation messages for RAG responses
- [ ] T098 [US2] Add document processing status updates (processing → completed/failed) with error handling

### Frontend Implementation for US2

- [ ] T099 [P] [US2] Create FileUpload component in frontend/src/components/upload/FileUpload.tsx with drag-and-drop support
- [ ] T100 [P] [US2] Create UploadProgress component in frontend/src/components/upload/UploadProgress.tsx showing processing status
- [ ] T101 [P] [US2] Create DocumentList component in frontend/src/components/upload/DocumentList.tsx to display uploaded documents
- [ ] T102 [US2] Create documents page in frontend/src/app/(dashboard)/documents/page.tsx for document management
- [ ] T103 [US2] Create Citation component in frontend/src/components/chat/Citation.tsx to display source references with file name and page
- [ ] T104 [US2] Update MessageList to render citations below RAG-generated messages
- [ ] T105 [US2] Wire up file upload API calls with progress tracking
- [ ] T106 [US2] Add document deletion functionality with confirmation dialog
- [ ] T107 [US2] Add error handling for upload failures (file too large, malicious file, processing errors)

**Checkpoint**: User Story 1 AND 2 should both work independently. Users can upload documents, manage them, and ask questions about their content while maintaining chat functionality.

---

## Phase 5: User Story 3 - SQL Database Queries (Priority: P3)

**Goal**: Users can connect SQL databases and ask natural language questions, receiving both answers and generated SQL queries

**Independent Test**: User connects PostgreSQL database, asks "Top 5 products last quarter?", receives table with results and SQL shown, completes within 3 seconds

### Backend Implementation for US3

- [ ] T108 [P] [US3] Create DatabaseConnection entity types in backend/src/models/database.types.ts (if not generated)
- [ ] T109 [US3] Create encryption service in backend/src/services/database/encryption.ts using AES-256-GCM for connection strings
- [ ] T110 [US3] Create database connector in backend/src/services/database/connector.ts to validate and establish PostgreSQL connections
- [ ] T111 [US3] Create schema discovery service in backend/src/services/database/schemaDiscovery.ts to introspect tables, columns, types, relationships
- [ ] T112 [US3] Create SQL validator in backend/src/services/database/sqlValidator.ts using pgsql-ast-parser to prevent DROP, DELETE, UPDATE operations
- [ ] T113 [US3] Create SQL executor in backend/src/services/database/sqlExecutor.ts with timeout (5s) and row limits (1000)
- [ ] T114 [US3] Create SQL Agent query generator in backend/src/agents/sql/queryGenerator.ts to generate SQL from natural language using LLM with schema context
- [ ] T115 [US3] Create SQL Agent result formatter in backend/src/agents/sql/resultFormatter.ts to format results conversationally with optional table view
- [ ] T116 [US3] Create SQL Agent responder in backend/src/agents/sql/responder.ts orchestrating generate → validate → execute → format with confirmation for ambiguous queries
- [ ] T117 [US3] Create POST /api/database-connections endpoint in backend/src/api/routes/databaseConnections.ts to add new connection
- [ ] T118 [US3] Create GET /api/database-connections endpoint in backend/src/api/routes/databaseConnections.ts to list connections
- [ ] T119 [US3] Create GET /api/database-connections/:id endpoint in backend/src/api/routes/databaseConnections.ts to get connection details
- [ ] T120 [US3] Create GET /api/database-connections/:id/schema endpoint in backend/src/api/routes/databaseConnections.ts to get schema snapshot
- [ ] T121 [US3] Create DELETE /api/database-connections/:id endpoint in backend/src/api/routes/databaseConnections.ts to remove connection
- [ ] T122 [US3] Update Master Agent router to detect sql_query intent and route to SQL Agent
- [ ] T123 [US3] Update WebSocket chat handler to support SQL query display (show generated SQL before/after execution)
- [ ] T124 [US3] Add input sanitization to prevent SQL injection attempts with friendly error messages

### Frontend Implementation for US3

- [ ] T125 [P] [US3] Create DatabaseConnectionForm component in frontend/src/components/settings/DatabaseConnectionForm.tsx for adding connections
- [ ] T126 [P] [US3] Create DatabaseConnectionList component in frontend/src/components/settings/DatabaseConnectionList.tsx to display connections with status
- [ ] T127 [P] [US3] Create SQLDisplay component in frontend/src/components/chat/SQLDisplay.tsx to show generated SQL with syntax highlighting
- [ ] T128 [P] [US3] Create TableView component in frontend/src/components/chat/TableView.tsx to render SQL results as formatted table
- [ ] T129 [US3] Create settings page in frontend/src/app/(dashboard)/settings/page.tsx for database connection management
- [ ] T130 [US3] Update MessageList to render SQL queries and table results
- [ ] T131 [US3] Wire up database connection API calls with validation status updates
- [ ] T132 [US3] Add connection testing functionality before saving
- [ ] T133 [US3] Add error handling for connection failures (invalid credentials, unreachable host, non-read-only user)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently. Users can chat, upload documents, query them, connect databases, and query databases with natural language.

---

## Phase 6: User Story 4 - Multi-Source Research (Priority: P4)

**Goal**: Users can request in-depth research with automatic multi-source searching and synthesis into comprehensive reports

**Independent Test**: User requests "Research vector databases for LLMs", system searches 5+ sources, delivers report with citations in 2-5 minutes

### Backend Implementation for US4

- [ ] T134 [P] [US4] Create ResearchReport and SearchSource entity types in backend/src/models/database.types.ts (if not generated)
- [ ] T135 [US4] Create SearchProvider interface in backend/src/services/search/provider.ts with search and validateSource methods
- [ ] T136 [P] [US4] ✅ API KEY READY - Implement Tavily provider in backend/src/services/search/tavily.ts as primary search (API key already configured in .env)
- [ ] T137 [P] [US4] ✅ API KEY READY - Implement Brave provider in backend/src/services/search/brave.ts as fallback (API key already configured in .env)
- [ ] T138 [P] [US4] ✅ API KEY READY - Implement Firecrawl provider in backend/src/services/search/firecrawl.ts for web scraping (API key already configured in .env)
- [ ] T139 [P] [US4] ✅ API KEY READY - Implement Context7 provider in backend/src/services/search/context7.ts for context-aware search (API key already configured in .env)
- [ ] T140 [P] [US4] ✅ API KEY READY - Implement NewsAPI provider in backend/src/services/search/newsapi.ts for news aggregation (API key already configured in .env)
- [ ] T141 [P] [US4] Implement Semantic Scholar provider in backend/src/services/search/semanticScholar.ts for academic papers (no API key required)
- [ ] T142 [P] [US4] Implement arXiv provider in backend/src/services/search/arxiv.ts for research papers (no API key required)
- [ ] T143 [P] [US4] Implement PubMed provider in backend/src/services/search/pubmed.ts for medical papers (no API key required)
- [ ] T144 [P] [US4] ✅ API KEY READY - Implement GitHub provider in backend/src/services/search/github.ts for code search (API key already configured in .env)
- [ ] T145 [US4] Create search provider registry in backend/src/services/search/registry.ts with priority ordering and graceful degradation
- [ ] T146 [US4] Create source credibility scorer in backend/src/services/search/credibilityScorer.ts checking domain reputation, publish date, author
- [ ] T147 [US4] Create safety filter in backend/src/services/search/safetyFilter.ts to refuse dangerous requests (weapons, explosives, illegal activities)
- [ ] T148 [US4] Create Research Agent orchestrator in backend/src/agents/research/orchestrator.ts managing multi-provider search with progress updates
- [ ] T149 [US4] Create Research Agent report generator in backend/src/agents/research/reportGenerator.ts synthesizing findings into structured report (Summary, Key Findings, Sources, Methodology)
- [ ] T150 [US4] Create background job service in backend/src/services/research/jobService.ts for async processing with progress tracking
- [ ] T151 [US4] Create GET /api/research endpoint in backend/src/api/routes/research.ts to list research reports
- [ ] T152 [US4] Create GET /api/research/:id endpoint in backend/src/api/routes/research.ts to get report details
- [ ] T153 [US4] Create DELETE /api/research/:id endpoint in backend/src/api/routes/research.ts to delete report
- [ ] T154 [US4] Update Master Agent router to detect research_request intent and route to Research Agent
- [ ] T155 [US4] Update WebSocket chat handler to support progress messages for research jobs
- [ ] T156 [US4] Add research job timeout (10 min) with partial results on timeout
- [ ] T157 [US4] Add handling for all provider failures (return partial results with error notice per clarification)

### Frontend Implementation for US4

- [ ] T158 [P] [US4] Create ResearchProgress component in frontend/src/components/chat/ResearchProgress.tsx showing progress bar and status
- [ ] T159 [P] [US4] Create ResearchReport component in frontend/src/components/chat/ResearchReport.tsx displaying structured report with sections
- [ ] T160 [P] [US4] Create SourceList component in frontend/src/components/chat/SourceList.tsx showing clickable citations with credibility scores
- [ ] T161 [US4] Create research page in frontend/src/app/(dashboard)/research/page.tsx for browsing past reports
- [ ] T162 [US4] Update MessageList to render research progress and completed reports
- [ ] T163 [US4] Wire up progress message handling in WebSocket client
- [ ] T164 [US4] Add research depth selection UI (quick/standard/deep) in message input
- [ ] T165 [US4] Add cancel research job functionality
- [ ] T166 [US4] Add error handling for safety filter rejections with user-friendly message

**Checkpoint**: User Stories 1-4 all work independently. Users can perform basic chat, document queries, database queries, and multi-source research.

---

## Phase 7: User Story 5 - Multi-Step Workflows (Priority: P5)

**Goal**: Users can execute complex multi-step requests with automatic Master Agent coordination between sub-agents

**Independent Test**: User sends "Research top 3 Python frameworks, add to knowledge base, tell me which we used most in projects DB". System executes all steps and returns final synthesis.

### Backend Implementation for US5

- [ ] T167 [US5] Create workflow decomposer in backend/src/agents/master/workflowDecomposer.ts to parse multi-step requests into individual agent tasks
- [ ] T168 [US5] Create workflow executor in backend/src/agents/master/workflowExecutor.ts to orchestrate sequential agent calls with context passing
- [ ] T169 [US5] Create workflow state manager in backend/src/agents/master/workflowState.ts to track progress and handle failures
- [ ] T170 [US5] Update Master Agent router to detect multi_step_workflow intent and route to workflow executor
- [ ] T171 [US5] Add workflow pause/resume capability for long-running workflows when user closes browser
- [ ] T172 [US5] Add workflow failure reporting (which step failed, what was completed, retry/continue options)
- [ ] T173 [US5] Add integration between Research Agent and RAG Agent for "add to knowledge base" step
- [ ] T174 [US5] Update WebSocket chat handler to support workflow step progress messages

### Frontend Implementation for US5

- [ ] T175 [P] [US5] Create WorkflowProgress component in frontend/src/components/chat/WorkflowProgress.tsx showing multi-step progress
- [ ] T176 [US5] Update MessageList to render workflow progress with step indicators
- [ ] T177 [US5] Add workflow retry/continue UI for failed steps
- [ ] T178 [US5] Add workflow cancellation functionality

**Checkpoint**: All user stories (1-5) now work independently and in combination. Full system functionality achieved.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T179 [P] Create user settings page in frontend/src/app/(dashboard)/settings/profile/page.tsx for LLM model preferences
- [ ] T180 [P] Create usage dashboard page in frontend/src/app/(dashboard)/usage/page.tsx showing monthly costs, token usage by model, remaining budget
- [ ] T181 [P] Implement budget warning notifications (at 80% and 100% of $10 monthly limit)
- [ ] T182 [P] Create GET /api/settings endpoint in backend/src/api/routes/settings.ts to get user settings
- [ ] T183 [P] Create PUT /api/settings endpoint in backend/src/api/routes/settings.ts to update user settings
- [ ] T184 [P] Create GET /api/usage endpoint in backend/src/api/routes/usage.ts to get monthly usage stats
- [ ] T185 [P] Create health check endpoint GET /api/health in backend/src/api/routes/health.ts with database and LLM provider status
- [ ] T186 [P] Add comprehensive error logging to all services with structured context (user_id, conversation_id, agent_used, model_used, latency, tokens)
- [ ] T187 [P] Create development seed data in supabase/seed.sql for testing (sample user, conversations, documents)
- [ ] T188 [P] Add input validation middleware to all API endpoints with Zod schemas
- [ ] T189 [P] Optimize database queries with proper indexes (already in migration, verify performance)
- [ ] T190 [P] Add security headers middleware (helmet.js) to Express app
- [ ] T191 [P] Create README.md in repository root with project overview, setup instructions, architecture diagram
- [ ] T192 [P] Create CONTRIBUTING.md with development workflow, code standards, PR checklist
- [ ] T193 [P] Implement conversation history pruning (keep last 20 messages in context window per clarification)
- [ ] T194 Run quickstart.md validation steps to verify all components work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) once Foundation is done
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 but integrates with chat
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 but integrates with chat
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Independent but can integrate with US2 (add research to knowledge base)
- **User Story 5 (P5)**: DEPENDS on US1, US2, US3, US4 being complete (orchestrates between all agents)

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints/handlers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Stories 1-4 can start in parallel (if team capacity allows)
- All tasks within a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all parallel backend services for US1:
- T053: Create User entity types
- T054: Create Conversation and Message entity types
- T070: Create login page (frontend)
- T071: Create signup page (frontend)
- T072: Create password reset page (frontend)
- T075: Create MessageList component
- T076: Create MessageInput component
- T077: Create StreamingMessage component

# After foundational services complete, these can run in parallel:
- T061: POST /api/auth/signup endpoint
- T062: POST /api/auth/login endpoint
- T063: POST /api/auth/logout endpoint
- T064: GET /api/conversations endpoint
- T065: POST /api/conversations endpoint
- T066: GET /api/conversations/:id endpoint
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T015)
2. Complete Phase 2: Foundational (T016-T052) - CRITICAL BLOCKER
3. Complete Phase 3: User Story 1 (T053-T082)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Can users sign up?
   - Can users log in and chat?
   - Does session persist on refresh?
   - Are responses received within 2 seconds?
   - Does budget tracking work?
5. Deploy/demo MVP if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T052)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T053-T082)
3. Add User Story 2 → Test independently → Deploy/Demo (T083-T107)
4. Add User Story 3 → Test independently → Deploy/Demo (T108-T133)
5. Add User Story 4 → Test independently → Deploy/Demo (T134-T166)
6. Add User Story 5 → Test independently → Deploy/Demo (T167-T178)
7. Add Polish → Final testing → Production release (T179-T194)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T052)
2. Once Foundational is done:
   - Developer A: User Story 1 (T053-T082)
   - Developer B: User Story 2 (T083-T107)
   - Developer C: User Story 3 (T108-T133)
   - Developer D: User Story 4 (T134-T166)
3. After US1-4 complete:
   - Developer E: User Story 5 (T167-T178) - requires all previous stories
   - Team: Polish tasks in parallel (T179-T194)

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing (if TDD approach used)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **Total tasks: 194** (including all user stories + polish)
- **MVP tasks (US1 only)**: T001-T082 (82 tasks)
- **Core features (US1-3)**: T001-T133 (133 tasks)
- **Full system**: T001-T194 (194 tasks)
- **✅ API Keys Configured**: All search providers (Tavily, Brave, Firecrawl, Context7, NewsAPI, GitHub), AI providers (OpenAI, Anthropic, Gemini), and infrastructure (Supabase, LangSmith) are pre-configured in .env
