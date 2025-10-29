# Quickstart Guide: Personal AI Assistant

**Feature**: 001-personal-ai-assistant
**Date**: 2025-10-27
**Target Audience**: Developers setting up local development environment

## Prerequisites

Before starting, ensure you have:

- **Node.js 20 LTS** installed ([download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Supabase CLI** installed (`npm install -g supabase`)
- **Git** for version control
- **Code editor** (VS Code recommended)

Optional:
- **PostgreSQL client** (psql, TablePlus, or DBeaver) for database inspection
- **API testing tool** (Postman, Insomnia, or Thunder Client)

---

## 1. Clone Repository

```bash
git clone <repository-url>
cd master_agent
git checkout 001-personal-ai-assistant
```

---

## 2. Environment Setup

### Supabase Project

1. **Create Supabase project** (if not exists):
   ```bash
   supabase init
   supabase start
   ```

2. **Or link to existing project**:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. **Get connection details**:
   ```bash
   supabase status
   ```

   Note down:
   - **API URL**: `http://localhost:54321`
   - **Anon Key**: `eyJhbGc...` (public key)
   - **Service Role Key**: `eyJhbGc...` (admin key - keep secret!)
   - **DB URL**: `postgresql://postgres:postgres@localhost:54322/postgres`

### Environment Variables

A complete `.env.example` file has been provided at the project root with all required API keys and configuration.

**Quick Setup**:

```bash
# Copy the example file
cp .env.example .env

# The .env file is already populated with your API keys
# Review and update if needed
```

**Environment File Structure**:

The `.env` file at the project root includes:

#### Supabase Configuration
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_PUBLIC` - Public anon key for frontend
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for backend (keep secret!)
- `SUPABASE_PROJECT_ID` - Project identifier
- `SUPABASE_ACCESS_TOKEN` - CLI access token

#### AI Provider Configuration
- `OPENAI_API_KEY` - For GPT-4, GPT-3.5-turbo, text-embedding-3-large
- `ANTHROPIC_API_KEY` - For Claude Sonnet 4.5, Claude Haiku
- `GEMINI_API_KEY` - For document metadata extraction

#### Search Providers (Research Agent)
- `TAVILY_API_KEY` - Primary research provider
- `BRAVE_API_KEY` - Fallback search provider
- `FIRECRAWL_API_KEY` - Web scraping and content extraction
- `CONTEXT7_API_KEY` - Context-aware search
- `NEWSAPI_KEY` - News article aggregation

#### Development & Observability
- `LANGSMITH_API_KEY` - LangChain debugging and observability
- `GITHUB_PERSONAL_ACCESS_TOKEN` - Repository integration

#### Application Configuration
- `PORT=3001` - Backend server port
- `NODE_ENV=development` - Environment mode
- `MONTHLY_BUDGET_USD=10.00` - LLM API cost limit per user
- `MAX_FILE_SIZE_MB=100` - File upload limit
- `API_RATE_LIMIT=100` - Requests per minute per user
- `WS_RATE_LIMIT=10` - WebSocket messages per second

**All API keys are already configured in the .env file. You're ready to start development!**

#### `frontend/.env.local` (Create Separately)

The frontend needs its own `.env.local` file with public-facing environment variables only:

```bash
# Supabase (public keys only - safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://omjwoyyhpdawjxsbpamc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDQyMTUsImV4cCI6MjA3NzE4MDIxNX0.blSSFEciIvXq7B6zrpob-CQKCRKFmF0qq6Tavk6KzsQ

# Backend WebSocket & API
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Security Note**: Only the anon key is exposed to the frontend. Never put the service role key in frontend environment variables!

---

## 3. Database Setup

### Run Migrations

```bash
cd supabase
supabase migration new initial_schema
```

Copy the migration SQL from `data-model.md` into the migration file, then apply:

```bash
supabase db reset  # Resets DB and applies all migrations
```

### Verify Tables

```bash
supabase db diff  # Should show no changes if migrations applied
```

Or connect via psql:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres

# List tables
\dt

# Should see: user_settings, conversations, messages, documents, chunks,
#             database_connections, research_reports, search_sources
```

### Enable Extensions

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 4. Install Dependencies

### Backend

```bash
cd backend
npm install

# Key dependencies installed:
# - express (HTTP server)
# - ws (WebSocket server)
# - @supabase/supabase-js (Supabase client)
# - openai (OpenAI SDK)
# - @anthropic-ai/sdk (Anthropic SDK)
# - pdf-parse, mammoth, xlsx (document parsing)
# - cohere-ai (reranking)
```

### Frontend

```bash
cd frontend
npm install

# Key dependencies installed:
# - next (Next.js 15)
# - react, react-dom (React 18+)
# - @supabase/supabase-js (auth client)
# - zustand (state management)
# - @shadcn/ui components
# - tailwindcss (styling)
```

---

## 5. Start Development Servers

### Terminal 1: Supabase (if using local)

```bash
supabase start
```

Keep this running.

### Terminal 2: Backend

```bash
cd backend
npm run dev  # Starts Express + WebSocket server on :3001
```

Expected output:
```
🚀 Backend server running on http://localhost:3001
🔌 WebSocket server listening on ws://localhost:3001/ws
```

### Terminal 3: Frontend

```bash
cd frontend
npm run dev  # Starts Next.js dev server on :3000
```

Expected output:
```
▲ Next.js 15.0.0
- Local:        http://localhost:3000
- Ready in 1.2s
```

---

## 6. Verify Setup

### Test 1: Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T12:34:56.789Z"
}
```

### Test 2: Database Connection

```bash
curl http://localhost:3001/api/health/db
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "extensions": ["vector", "pg_trgm"]
}
```

### Test 3: Frontend

Open browser to http://localhost:3000

You should see:
- Login/signup page
- Next.js dev overlay (if any errors)

### Test 4: Create Account

1. Click "Sign up"
2. Enter email: `test@example.com`
3. Enter password: `TestPass123!`
4. Submit

Expected:
- Redirected to chat interface
- Welcome message displayed

### Test 5: Send Chat Message

1. Type: "Hello, who are you?"
2. Press Enter

Expected:
- Message appears in chat
- Streaming response from Master Agent
- Response completes within 2 seconds

---

## 7. Test RAG Workflow (Optional)

### Upload Test Document

1. Create `test-document.txt`:
   ```txt
   The Personal AI Assistant project uses a multi-agent architecture.
   The Master Agent handles intent classification.
   The RAG Agent retrieves information from uploaded documents.
   ```

2. Upload via UI or API:
   ```bash
   curl -X POST http://localhost:3001/api/documents \
     -H "Authorization: Bearer <your-jwt-token>" \
     -F "file=@test-document.txt"
   ```

3. Wait for processing (watch backend logs):
   ```
   📄 Document uploaded: test-document.txt
   ✂️  Chunking: 1 chunks created
   🧮 Generating embeddings...
   ✅ Document processed successfully
   ```

4. Query the document:
   - Type: "What does my document say about the RAG Agent?"
   - Expected: Response citing the uploaded document

---

## 8. Test SQL Workflow (Optional)

### Connect to Test Database

1. Create test PostgreSQL database:
   ```sql
   CREATE DATABASE test_analytics;

   \c test_analytics

   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     name VARCHAR(100),
     signup_date DATE
   );

   INSERT INTO users (name, signup_date) VALUES
     ('Alice', '2024-01-15'),
     ('Bob', '2024-02-20'),
     ('Charlie', '2024-03-10');
   ```

2. Add connection via UI or API:
   ```bash
   curl -X POST http://localhost:3001/api/database-connections \
     -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Analytics",
       "dbType": "postgresql",
       "connectionString": "postgresql://postgres:postgres@localhost:5432/test_analytics"
     }'
   ```

3. Wait for schema discovery (watch backend logs):
   ```
   🔗 Validating connection: Test Analytics
   📊 Schema discovered: 1 tables, 3 columns
   ✅ Connection active
   ```

4. Query the database:
   - Type: "How many users signed up in February 2024?"
   - Expected: SQL query shown, result: "1 user (Bob)"

---

## 9. Test Research Workflow (Optional)

Requires API keys for search providers (Tavily, Brave, etc.)

1. Request research:
   - Type: "Research the latest developments in vector databases"
   - Select depth: "Quick" (2 min)

2. Watch progress:
   - Progress bar should update: 0% → 25% → 50% → 100%
   - Status messages: "Searching Tavily...", "Searching arXiv...", etc.

3. Review report:
   - Structured report with summary, key findings, sources
   - Citations clickable

---

## 10. Run Tests (Optional)

### Backend Tests

```bash
cd backend
npm test  # Runs Vitest unit + integration tests
```

Expected:
```
✓ agents/master/intentClassifier.test.ts (5 tests)
✓ services/embeddings/chunker.test.ts (8 tests)
✓ services/database/sqlValidator.test.ts (12 tests)
...
Test Files  15 passed (15)
     Tests  87 passed (87)
```

### Frontend Tests

```bash
cd frontend
npm test  # Runs Vitest component tests
```

### E2E Tests

```bash
cd frontend
npm run test:e2e  # Runs Playwright tests
```

Expected:
```
Running 10 tests using 3 workers
✓ auth.spec.ts:5:1 › User can sign up
✓ chat.spec.ts:8:1 › User can send message
✓ upload.spec.ts:12:1 › User can upload document
...
10 passed (15.3s)
```

---

## 11. Troubleshooting

### Issue: "Cannot connect to Supabase"

**Symptoms**: Frontend shows "Auth error" or backend fails to start

**Solution**:
1. Check Supabase is running: `supabase status`
2. Verify `.env` has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Restart Supabase: `supabase stop && supabase start`

### Issue: "OpenAI API key invalid"

**Symptoms**: Chat messages fail with "LLM_ERROR"

**Solution**:
1. Verify API key is correct: https://platform.openai.com/api-keys
2. Check key has credits: https://platform.openai.com/account/usage
3. Update `backend/.env` with valid key
4. Restart backend: `npm run dev`

### Issue: "WebSocket connection failed"

**Symptoms**: Chat messages don't stream, connection error in console

**Solution**:
1. Check backend is running on port 3001
2. Verify `NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws` in `frontend/.env.local`
3. Check browser console for CORS errors
4. Ensure no other process is using port 3001: `lsof -i :3001`

### Issue: "Database migrations failed"

**Symptoms**: Tables missing, RLS errors

**Solution**:
1. Reset database: `supabase db reset`
2. Check migration file syntax: `supabase migration list`
3. Apply manually: `psql <DATABASE_URL> < supabase/migrations/001_initial_schema.sql`

### Issue: "Vector search not working"

**Symptoms**: RAG queries return no results or error

**Solution**:
1. Verify pgvector extension: `SELECT * FROM pg_extension WHERE extname = 'vector';`
2. Check index exists: `\d chunks` (should show ivfflat index on embedding column)
3. Verify embeddings are generated (non-null): `SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL;`

### Issue: "Rate limit exceeded"

**Symptoms**: Chat messages fail after several requests

**Solution**:
1. This is expected behavior (10 messages/second limit)
2. Wait 1 second between messages
3. For testing, disable rate limit in `backend/src/websocket/middleware/rateLimiter.ts`

---

## 12. Next Steps

After verifying the setup works:

1. **Explore the codebase**:
   - `backend/src/agents/` - Agent implementations
   - `frontend/src/app/` - Next.js pages
   - `frontend/src/components/` - UI components

2. **Review the architecture**:
   - See `plan.md` for project structure
   - See `data-model.md` for database schema
   - See `contracts/` for API specifications

3. **Start implementing**:
   - Follow `tasks.md` (generated via `/speckit.tasks`)
   - Begin with Phase 1 (Setup) and Phase 2 (Foundational)
   - Implement user stories in priority order (P1 → P2 → P3)

4. **Run the full test suite**:
   ```bash
   # Backend
   cd backend && npm test

   # Frontend
   cd frontend && npm test && npm run test:e2e
   ```

5. **Deploy to production** (when ready):
   - Frontend: Connect Vercel to GitHub repo
   - Backend: Connect Railway to GitHub repo
   - Database: Create Supabase production project
   - Update production `.env` files with production URLs and keys

---

## 13. Useful Commands

### Development

```bash
# Start all services
npm run dev:all  # (if package.json script configured)

# Restart backend only
cd backend && npm run dev

# Restart frontend only
cd frontend && npm run dev

# View logs
cd backend && npm run logs  # Tails backend logs
cd frontend && npm run logs # Tails Next.js logs
```

### Database

```bash
# Create new migration
supabase migration new <name>

# Apply migrations
supabase db reset

# Rollback last migration
supabase migration down

# Generate TypeScript types from database
supabase gen types typescript --local > backend/src/models/database.types.ts
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- agents/master/intentClassifier.test.ts

# Run tests in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e -- --headed
```

### Deployment

```bash
# Build for production
cd frontend && npm run build
cd backend && npm run build

# Start production server
cd frontend && npm start
cd backend && npm start
```

---

## 14. Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Next.js automatically reloads on file changes
- **Backend**: Uses `nodemon` (install: `npm install -D nodemon`)

### Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    },
    {
      "name": "Frontend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

Use structured logging in backend:

```typescript
import { logger } from './lib/logger';

logger.info({
  event: 'rag_query',
  userId: user.id,
  conversationId: conversationId,
  chunksRetrieved: 5,
  latencyMs: 1823
});
```

### Code Formatting

```bash
# Format all files
npm run format

# Lint and fix
npm run lint -- --fix
```

---

## 15. Support

If you encounter issues not covered in this guide:

1. Check backend logs: `cd backend && tail -f logs/app.log`
2. Check frontend console: Open browser DevTools (F12)
3. Review error messages carefully
4. Search existing GitHub issues
5. Create new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs/screenshots
   - Environment details (OS, Node version, etc.)

---

**Quickstart Complete!** You should now have a fully functional local development environment. Proceed to implementation following `tasks.md`.
