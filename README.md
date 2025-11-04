# Personal AI Assistant

A powerful, production-ready AI assistant with hybrid RAG search, multi-agent orchestration, SQL query generation, and web research capabilities. Built with modern TypeScript, Next.js 15, and Claude/GPT models.

## Features

### 🤖 Multi-Agent System
- **Master Agent**: Intelligent routing and orchestration
- **RAG Agent**: Document Q&A with hybrid search (semantic + keyword)
- **SQL Agent**: Natural language to SQL query generation
- **Research Agent**: Graduate-level research with web scraping and synthesis

### 📚 Knowledge Management
- Upload PDF, TXT, MD, DOCX, CSV, XLSX files
- Automatic chunking and embedding with OpenAI text-embedding-3-small
- Hybrid search with pgvector (semantic) + pg_trgm (keyword)
- Cohere reranking for improved relevance
- Source citations with relevance scores

### 💬 Real-time Chat
- WebSocket-based streaming responses
- Conversation history with automatic title generation
- Multi-turn context awareness
- Budget tracking and warnings

### 💰 Cost Management
- Per-user monthly budget limits ($0-$1000)
- Real-time cost tracking by model
- Budget warnings at 80% usage
- Hard limits at 100% to prevent overspending
- Detailed usage analytics dashboard

### 🔌 Database Integration
- Connect to external PostgreSQL, MySQL databases
- Natural language to SQL translation
- Query history and favorites
- Secure credential encryption

### 🔬 Research Capabilities
- Graduate-level research projects (5000-10000 words)
- Multi-source aggregation (Tavily, Brave, arXiv, Semantic Scholar, OpenAlex)
- Automatic theme identification and synthesis
- Citation support (APA, MLA, Chicago)
- Markdown export with full report

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Chat   │  │Documents │  │ Settings │  │  Usage   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                    WebSocket Client (Real-time)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    Backend (Express + WebSocket)             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Master Agent (Orchestrator)               │ │
│  │    - Intent Classification (general/RAG/SQL/research)  │ │
│  │    - Smart Routing with Context                        │ │
│  └───────┬──────────────┬───────────────┬─────────────────┘ │
│          │              │               │                    │
│  ┌───────▼──────┐ ┌────▼─────┐  ┌──────▼────────┐         │
│  │  RAG Agent   │ │SQL Agent │  │Research Agent │         │
│  │  - Hybrid    │ │- Schema  │  │- Multi-source │         │
│  │    Search    │ │  Analysis│  │- Synthesis    │         │
│  │  - Reranking │ │- Query   │  │- Citations    │         │
│  └──────────────┘ │  Gen     │  └───────────────┘         │
│                   └──────────┘                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    Supabase (PostgreSQL 15+)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Documents │  │  Chunks  │  │Messages  │  │  Usage   │   │
│  │  +Title  │  │+Embedding│  │ +Sources │  │ +Budget  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│      pgvector (semantic) + pg_trgm (keyword search)         │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js 20 LTS** or higher
- **PostgreSQL 15+** (via Supabase or self-hosted)
- **API Keys**:
  - OpenAI API key (for embeddings and GPT models)
  - Anthropic API key (for Claude models)
  - Tavily API key (for web research)
  - Brave Search API key (optional, for research)
  - Cohere API key (optional, for reranking)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd master_agent

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup (Supabase)

1. Create a Supabase project at https://supabase.com
2. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
3. Run migrations in order from `supabase/migrations/`:
   - `20251027000000_initial_schema.sql`
   - `20251028000000_add_search_functions.sql`
   - `20251029000000_tabular_data_system.sql`
   - `20251031000000_add_document_title.sql`
   - `20251031000001_add_conversation_title.sql`
   - `20251101000000_add_sql_agent_schema.sql`
   - `20251102000000_graduate_research_system.sql`
   - `20251102000001_add_budget_settings.sql` ⚠️ **Required for Settings page**

### 3. Environment Variables

#### Backend (`backend/.env`)

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Research APIs
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=... # Optional
COHERE_API_KEY=... # Optional, for reranking

# Server
PORT=4000
NODE_ENV=development

# Budget (optional, default $10/month)
MONTHLY_BUDGET_USD=10.00
```

#### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### 4. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Access the application at http://localhost:3000

## User Guide

### Getting Started

1. **Sign Up / Login**: Create an account or sign in with existing credentials
2. **Upload Documents**: Click "Add Knowledge" to upload PDFs, text files, or spreadsheets
3. **Start Chatting**: Ask questions about your documents or request research

### Chat Features

#### RAG Mode (Document Q&A)
```
"What does my contract say about termination?"
"Summarize the main findings in my research paper"
"Find all mentions of revenue in my financial documents"
```

**Advanced Settings** (gear icon):
- **Discipline Level**: strict/moderate/exploration
- **Relevance Score**: Minimum threshold (0.0-1.0)
- **RAG-Only Mode**: Only search uploaded documents
- **File Type Filter**: PDF, TXT, MD, etc.
- **Date Range**: Filter by upload date
- **Top K**: Number of chunks to retrieve
- **Reranking**: Use Cohere for better relevance

#### SQL Mode (Database Queries)
```
"Show me the top 10 customers by revenue"
"What's the average order value this month?"
"Count all products in the electronics category"
```

1. Connect database via "Databases" page
2. Ask natural language questions
3. View generated SQL and results

#### Research Mode
```
"Research the history of artificial intelligence"
"Write a graduate-level paper on climate change (7500 words)"
```

1. Click "Research" button
2. Enter topic and word count target
3. Choose citation style (APA/MLA/Chicago)
4. Monitor progress in real-time
5. Download markdown report when complete

### Settings

Configure your AI preferences at `/settings`:

- **Default Chat Model**: Claude Sonnet 4, GPT-4, etc.
- **RAG Model**: Override for document Q&A (optional)
- **SQL Model**: Override for query generation (optional)
- **Research Model**: Override for research tasks (optional)
- **Monthly Budget**: Set spending limit ($0-$1000)

### Usage Dashboard

Track your spending at `/usage`:

- Current month budget status with warnings
- Historical usage (last 6 months)
- Cost breakdown by model
- Token usage statistics

**Budget Warnings**:
- 🟡 Warning at 80% usage
- 🔴 Blocked at 100% usage

## API Documentation

### REST Endpoints

#### Conversations
- `GET /api/conversations` - List conversations (optional `?grouped=true`)
- `GET /api/conversations/:id` - Get conversation with messages
- `POST /api/conversations` - Create new conversation
- `PATCH /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation

#### Documents
- `GET /api/documents` - List uploaded documents
- `GET /api/documents/:id` - Get document details
- `POST /api/documents` - Upload document (multipart/form-data)
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/search?query=...` - Search documents

#### Settings & Usage
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `GET /api/usage?month=YYYY-MM` - Get monthly usage stats
- `GET /api/usage/budget` - Get current budget status

#### Database Connections
- `GET /api/database-connections` - List connections
- `POST /api/database-connections` - Create connection
- `PUT /api/database-connections/:id` - Update connection
- `DELETE /api/database-connections/:id` - Delete connection
- `POST /api/database-connections/:id/test` - Test connection

#### Research
- `POST /api/research` - Execute quick research
- `POST /api/research/graduate` - Create graduate research project
- `GET /api/research/graduate/:id` - Get project status
- `GET /api/research/graduate` - List all projects

### WebSocket Protocol

Connect to `ws://localhost:4000?token=<jwt>`

**Client → Server Messages**:
```typescript
{
  kind: 'chat',
  conversationId: string,
  content: string,
  settings?: ChatSettings
}
```

**Server → Client Messages**:
```typescript
// Stream start
{ kind: 'stream_start', messageId: string, agent: string, model: string }

// Stream chunks
{ kind: 'stream_chunk', messageId: string, chunk: string }

// Stream end
{ kind: 'stream_end', messageId: string, metadata: MessageMetadata }

// Citations
{ kind: 'citation', messageId: string, sources: SearchSource[] }

// Budget warning
{ kind: 'budget_warning', currentCost: number, limit: number, percentUsed: number }

// Errors
{ kind: 'error', error: string, code: string }
```

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI**: Shadcn UI + Tailwind CSS
- **State**: Zustand
- **WebSocket**: Native WebSocket API
- **Auth**: Supabase Auth

### Backend
- **Runtime**: Node.js 20 LTS with TypeScript
- **Framework**: Express.js
- **WebSocket**: ws library
- **Database**: Supabase (PostgreSQL 15+)
- **Vector Search**: pgvector
- **Keyword Search**: pg_trgm

### AI/ML
- **LLMs**: Claude Sonnet 4, GPT-4, GPT-3.5 Turbo
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Reranking**: Cohere rerank-english-v3.0
- **Research APIs**: Tavily, Brave, arXiv, Semantic Scholar, OpenAlex

## Performance Targets

- **Simple Chat**: < 500ms response time
- **RAG Query**: < 2s end-to-end (search + generation)
- **SQL Query**: < 3s (schema analysis + generation + execution)
- **Research**: 3-5 minutes for graduate-level papers
- **Uptime**: 99.9% target

## Cost Structure

**Default Models**:
- Claude Sonnet 4: $3.00 / 1M input tokens, $15.00 / 1M output tokens
- GPT-4: $5.00 / 1M input tokens, $15.00 / 1M output tokens
- GPT-3.5 Turbo: $0.50 / 1M input tokens, $1.50 / 1M output tokens

**Embeddings**:
- OpenAI text-embedding-3-small: $0.02 / 1M tokens

**Typical Usage** (per user/month):
- 100 chat messages: ~$0.50 - $2.00
- 20 document uploads: ~$0.10 - $0.50
- 5 research projects: ~$2.00 - $5.00
- **Total**: ~$3-8/month average

## Deployment

### Production Checklist

1. ✅ Set `NODE_ENV=production`
2. ✅ Configure production database (Supabase Pro recommended)
3. ✅ Set secure JWT secrets
4. ✅ Enable rate limiting (default: 100 req/15min)
5. ✅ Configure budget limits per user
6. ✅ Set up error monitoring (Sentry recommended)
7. ✅ Enable HTTPS/WSS for production
8. ✅ Configure CORS for your domain

### Recommended Hosting

- **Frontend**: Vercel (optimal for Next.js)
- **Backend**: Railway, Render, or AWS ECS
- **Database**: Supabase (managed PostgreSQL with pgvector)
- **File Storage**: Supabase Storage or AWS S3

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Check backend is running on port 4000
- Verify `NEXT_PUBLIC_WS_URL` in frontend .env
- Ensure JWT token is valid

**Document Upload Fails**
- Check file size < 100MB
- Verify `OPENAI_API_KEY` is set
- Check Supabase storage permissions

**RAG Returns No Results**
- Verify documents are chunked (check `document_chunks` table)
- Try lowering `minRelevanceScore` setting
- Check embeddings were generated

**Budget Exceeded Error**
- Check current usage at `/usage` dashboard
- Update budget limit at `/settings`
- Budget resets on 1st of each month

### Debug Mode

Enable verbose logging:
```bash
# Backend
DEBUG=* npm run dev

# Check logs
tail -f backend/logs/combined.log
```

## Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

## License

Private - All Rights Reserved

## Support

For questions or issues, please create a GitHub issue or contact the maintainer.

---

**Built with ❤️ using Claude Code**
