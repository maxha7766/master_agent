# Personal AI Assistant Constitution
<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================

  Version Change: Initial creation → v1.0.0

  Modified Principles:
  - All principles are new (initial constitution creation)

  Added Sections:
  - Core Principles (7 principles)
  - Technical Architecture Standards
  - Development Workflow
  - Governance

  Removed Sections:
  - None (initial creation)

  Templates Status:
  - ✅ plan-template.md: Reviewed - Constitution Check section compatible
  - ✅ spec-template.md: Reviewed - Requirements structure aligns
  - ✅ tasks-template.md: Reviewed - Task organization matches principles

  Follow-up TODOs:
  - None - all placeholders populated

  ============================================================================
-->

## Core Principles

### I. User-Centric Experience

**MUST** prioritize end-user experience over technical elegance:
- Responses MUST be brief, friendly, and lighthearted in tone
- Backend complexity MUST NOT be exposed to users
- System MUST provide natural conversation flow without forcing users to understand agent routing
- Response times MUST be optimized (< 2 seconds for simple queries, < 500ms for response initiation)
- All interfaces MUST follow mobile-first responsive design
- Error messages MUST be friendly and actionable, never exposing technical stack traces

**Rationale**: The assistant's value is measured by user satisfaction and task completion, not by technical sophistication. Users should feel they're talking to a helpful assistant, not debugging a system.

### II. Intelligent Architecture

**MUST** implement intelligent orchestration without manual user intervention:
- Master Agent MUST automatically classify intent and route to appropriate sub-agents (RAG, SQL, Research, or direct response)
- Agent transitions MUST be seamless - users MUST NEVER see "switching to agent X" messages
- Sub-agents MUST operate independently but cohesively, sharing context as needed
- Multi-step queries MUST be handled automatically (e.g., "research this topic then add it to my knowledge base")
- No manual agent selection or mode switching MUST be required from users

**Rationale**: Intelligence means the system adapts to the user, not the other way around. Manual mode selection is a failure of intent classification.

### III. Data Privacy & Security (NON-NEGOTIABLE)

**MUST** enforce strict data isolation and security:
- **Per-user data isolation**: Row-Level Security (RLS) policies MUST be enabled on ALL Supabase tables
- **No data leakage**: Users MUST NEVER see data from other users under any circumstance
- **Secure uploads**: File uploads MUST include virus scanning before processing
- **Encrypted storage**: Sensitive data (passwords, tokens, personal information) MUST be encrypted at rest
- **GDPR compliance**: Users MUST be able to delete all their data permanently (hard delete option)
- **Rate limiting**: MUST implement rate limiting (100 requests/min per user, 10 messages/sec per WebSocket)
- **Input validation**: ALL user inputs MUST be sanitized to prevent XSS and SQL injection

**Rationale**: Security and privacy are fundamental rights, not features. A single data leak destroys user trust irreparably.

### IV. Reliability & Performance

**MUST** maintain high availability and graceful degradation:
- **Uptime target**: 99.9% (< 8 hours downtime per year)
- **Automatic retry logic**: Failed operations MUST retry with exponential backoff (up to 3 attempts)
- **Graceful error handling**: When services fail, system MUST provide fallback responses, not crash
- **Background processing**: Long-running tasks (research agent) MUST run asynchronously with progress updates
- **Monitoring**: Health checks MUST run every 5 minutes with automatic alerting
- **Performance benchmarks**:
  - Page load < 1 second
  - RAG query < 2 seconds
  - SQL query < 3 seconds
  - Research (quick) < 2 minutes, (deep) < 5 minutes

**Rationale**: Users depend on the assistant being available and responsive. Downtime or slow responses break the conversational flow and reduce trust.

### V. Extensibility

**MUST** design for easy addition of new capabilities:
- **Modular agent architecture**: New agents MUST be addable without modifying existing agent code
- **Plugin-based tools**: Research agent search providers MUST implement `SearchProvider` interface for easy extension
- **Configuration-driven models**: LLM models MUST be switchable via user settings without code changes
- **Versioned API**: REST and WebSocket protocols MUST maintain backward compatibility across updates
- **Schema flexibility**: Tables MUST use JSONB for flexible data storage where schema evolution is expected

**Rationale**: User needs evolve, and new AI capabilities emerge rapidly. The system must adapt without major rewrites.

### VI. Code Quality & Testing

**MUST** maintain high code quality standards:
- **TypeScript everywhere**: Both frontend and backend MUST use TypeScript for type safety
- **Comprehensive error handling**: Every external call (LLM, database, API) MUST have try-catch with specific error types
- **Structured logging**: ALL operations MUST log with context (user ID, conversation ID, agent used, model used, response time)
- **Test coverage**: Target 80%+ coverage for critical paths (intent classification, agent routing, data isolation)
- **Test types required**:
  - Unit tests: Intent classification, SQL validation, chunking algorithms, schema discovery
  - Integration tests: Document upload pipeline, RAG search flow, WebSocket message flow
  - E2E tests: Full user journeys (signup → upload → query → view results)

**Rationale**: LLM integrations are inherently unpredictable. Robust error handling and testing prevent cascading failures and ensure data integrity.

### VIII. Frontend-Backend Debugging Protocol (MAJOR RULE)

**MUST** follow this systematic debugging process for ANY frontend-backend integration issues:

1. **Sequential Thinking Required**: MUST use sequential-thinking MCP tool to break down the problem step-by-step
2. **Automated Testing Required**: MUST use Puppeteer to automate browser testing until the issue is resolved
3. **No Manual Testing**: MUST NOT ask user to manually test until Puppeteer tests pass
4. **Complete Verification**: MUST verify the entire flow works end-to-end before reporting success

**Debugging Steps** (MUST follow in order):
1. Check backend logs for actual errors (not generic "unexpected error")
2. Verify API endpoint exists and is registered
3. Verify auth tokens are being sent correctly
4. Test API endpoint directly with curl/fetch
5. Create Puppeteer test that replicates user action
6. Fix issues found in Puppeteer test
7. Run Puppeteer test until it passes
8. ONLY THEN report to user that it's ready to test

**Rationale**: Frontend-backend integration bugs waste user time with repeated manual testing. Automated testing catches issues before user involvement and ensures fixes actually work.

### VII. Development Velocity

**MUST** optimize for rapid iteration and deployment:
- **Single environment**: Use one Supabase project (no dev/staging separation) - test locally, deploy to production
- **Auto-deployment**: Vercel and Railway MUST auto-deploy on push to `main` branch
- **Hot reload**: Local development MUST support hot reload for frontend and backend
- **Manual PR review**: No Railway preview environments - review code manually before merging
- **Migrations**: Database migrations MUST be versioned and applied via Supabase CLI

**Rationale**: This is a solo/small-team project. Multiple environments add overhead without proportional quality benefits. Focus on fast feedback loops.

## Technical Architecture Standards

### Stack Constraints

**Frontend (Vercel)**:
- Framework: Next.js 15 (App Router) - MUST NOT use Pages Router
- UI: Shadcn UI + Tailwind CSS - MUST NOT add additional UI libraries
- State: Zustand - MUST NOT use Redux or other heavy state management
- WebSocket: Native WebSocket API - MUST NOT use Socket.io

**Backend (Railway)**:
- Runtime: Node.js 20 LTS - MUST NOT use earlier versions
- Framework: Express.js - MUST NOT use NestJS or other frameworks
- WebSocket: `ws` library - MUST NOT use Socket.io
- Language: TypeScript - MUST NOT use JavaScript

**Database (Supabase)**:
- PostgreSQL 15+ with pgvector and pg_trgm extensions enabled
- MUST use Row-Level Security (RLS) on all tables
- MUST use JSONB for flexible schemas (table_data, research_sources)
- MUST NOT create dynamic tables at runtime

**LLM Integration**:
- MUST support multiple providers (OpenAI, Anthropic) via SDK
- MUST allow per-agent model configuration
- MUST implement streaming for chat responses
- Default models: Claude Sonnet 4.5 (RAG, Research), GPT-4 (SQL)

**Search & Processing**:
- MUST use hybrid search (vector + keyword) for RAG
- MUST implement Cohere reranking for RAG results
- MUST use Tavily as primary search, Brave as fallback
- Research agent MUST support extensible search providers via plugin interface

### Performance Requirements

**Response Times**:
- Simple chat message: < 500ms to first token
- RAG query: < 2 seconds total
- SQL query: < 3 seconds with retry
- Document processing: < 10 seconds for 10MB file
- Research (quick): < 2 minutes, (deep): < 5 minutes

**Scalability**:
- MUST support 1000+ concurrent users
- MUST handle 100GB+ of documents per user
- MUST process 1000+ research reports per month

**Constraints**:
- File upload limit: No hard limit, warn at 100MB
- WebSocket message rate: 10 messages/second per connection
- API rate limit: 100 requests/minute per user

### Security Requirements

**Authentication**:
- MUST use Supabase Auth for authentication
- MUST use JWT tokens with 24-hour expiry
- MUST store tokens in HTTP-only cookies
- MUST support email/password (OAuth optional for future)

**Authorization**:
- MUST enforce RLS policies on ALL tables
- MUST validate JWT on every request
- MUST log all authentication failures

**Data Protection**:
- MUST use HTTPS only (TLS 1.3)
- MUST sanitize all user inputs
- MUST use parameterized queries for SQL
- MUST scan uploaded files for viruses (ClamAV or equivalent)
- MUST implement CORS restrictions to frontend domain only

## Development Workflow

### Repository Structure

**MUST** follow this structure:
```
master_agent/
├── .specify/           # SpecKit templates and memory
├── frontend/           # Next.js application (deployed to Vercel)
├── backend/            # Express.js API + WebSocket server (deployed to Railway)
├── docs/               # User documentation
└── supabase/           # Database migrations and functions
```

### Branching & Deployment

**MUST** follow this workflow:
1. Create feature branch from `main`: `git checkout -b feature/description`
2. Develop locally with hot reload
3. Test locally against local Supabase (or shared Supabase)
4. Create PR with description and testing notes
5. Manual code review required before merge
6. Merge to `main` triggers auto-deploy to production (Vercel + Railway)
7. Monitor logs and health checks post-deployment

### Code Review Requirements

**MUST** verify in every PR:
- [ ] Constitution compliance (all 7 principles)
- [ ] TypeScript types correct and no `any` without justification
- [ ] Error handling present for all external calls
- [ ] Logging includes necessary context (user ID, timestamps)
- [ ] RLS policies correct on any new database tables
- [ ] Tests added/updated for changed functionality
- [ ] No hardcoded secrets or API keys

### Testing Gates

**MUST** pass before merge:
- All unit tests pass
- Integration tests pass for changed functionality
- E2E test for primary user journey passes
- Manual testing of new features completed
- No console errors in browser for frontend changes
- Supabase migrations apply successfully

### Complexity Justification

**MUST** justify any complexity that violates simplicity:
- Adding a new framework/library beyond approved stack
- Creating more than 3 sub-agents (Master, RAG, SQL, Research)
- Introducing new architectural patterns (e.g., CQRS, event sourcing)
- Adding caching layers (Redis) - must justify why Supabase query caching insufficient

**Process**: Document in plan.md under "Complexity Tracking" table with:
- What constraint is being violated
- Why it's needed (specific problem statement)
- What simpler alternative was rejected and why

## Governance

### Constitution Authority

This constitution **SUPERSEDES** all other development practices, conventions, and preferences. When in conflict:
1. Constitution principles override convenience
2. Security (Principle III) overrides all other principles
3. User experience (Principle I) overrides technical elegance
4. Reliability (Principle IV) overrides feature velocity

### Amendment Process

**MUST** follow this process to amend constitution:
1. **Proposal**: Document proposed change with rationale in GitHub issue
2. **Impact Analysis**: List all affected principles, templates, and existing code
3. **Migration Plan**: If breaking change, document migration steps
4. **Approval**: Solo project = self-approval; team project = consensus required
5. **Version Update**:
   - MAJOR bump: Backward incompatible governance changes (removing principles, redefining constraints)
   - MINOR bump: New principle added or existing principle materially expanded
   - PATCH bump: Clarifications, wording improvements, non-semantic changes
6. **Propagation**: Update all dependent templates and documentation
7. **Commit**: Use commit message format: `docs: amend constitution to vX.Y.Z (summary)`

### Compliance Review

**MUST** verify constitution compliance:
- **Every PR**: Reviewer checks Constitution Compliance checklist
- **Every spec**: `/speckit.specify` MUST include Constitution Check section
- **Every plan**: plan.md MUST have Constitution Check gates
- **Quarterly**: Review all code for drift from constitution principles

### Conflict Resolution

When principles conflict:
1. **Security first**: Principle III (Data Privacy & Security) always wins
2. **User experience second**: Principle I beats technical concerns
3. **Reliability third**: Principle IV beats performance optimization
4. **Document exception**: If legitimate conflict, document in plan.md and get explicit approval

### SpecKit Integration

**MUST** use SpecKit templates for all feature development:
- `.specify/templates/spec-template.md` for feature specifications
- `.specify/templates/plan-template.md` for implementation plans
- `.specify/templates/tasks-template.md` for task breakdown
- All templates MUST reference constitution principles in their Constitution Check sections

**Version**: 1.0.0 | **Ratified**: 2025-10-27 | **Last Amended**: 2025-10-27
