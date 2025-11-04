# 🚀 Deployment Plan: Railway + Vercel via GitHub

**Project:** Personal AI Assistant
**Backend:** Railway (Node.js/Express/WebSocket)
**Frontend:** Vercel (Next.js 15)
**Source:** GitHub Repository
**Date:** November 3, 2025

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Phase 1: GitHub Repository Setup](#phase-1-github-repository-setup)
3. [Phase 2: Supabase Production Database](#phase-2-supabase-production-database)
4. [Phase 3: Railway Backend Deployment](#phase-3-railway-backend-deployment)
5. [Phase 4: Vercel Frontend Deployment](#phase-4-vercel-frontend-deployment)
6. [Phase 5: Post-Deployment Configuration](#phase-5-post-deployment-configuration)
7. [Phase 6: Testing & Validation](#phase-6-testing--validation)
8. [Phase 7: Monitoring & Maintenance](#phase-7-monitoring--maintenance)
9. [Rollback Plan](#rollback-plan)
10. [Cost Estimation](#cost-estimation)

---

## 🎯 Sequential Deployment Strategy

### **Deployment Order:**
```
1. GitHub Repository Setup (Version Control)
   ↓
2. Supabase Production Database (Data Layer)
   ↓
3. Railway Backend Deployment (API + WebSocket)
   ↓
4. Vercel Frontend Deployment (UI)
   ↓
5. Integration Testing (E2E Validation)
```

**Rationale:** Database → Backend → Frontend ensures each layer has its dependencies ready.

---

## ✅ Pre-Deployment Checklist

### **Code Readiness**
- [x] All features complete (Phases 1-8: 100%)
- [x] Project cleanup complete (95% file reduction)
- [ ] Environment variables documented (.env.example)
- [ ] Sensitive data removed from code
- [ ] Debug logs disabled or controlled by env vars
- [ ] Error handling implemented throughout
- [ ] CORS configuration for production domains

### **Dependencies**
- [x] Backend package.json has build script (`tsc`)
- [x] Backend package.json has start script (`node dist/index.js`)
- [x] Frontend package.json has build script (`next build`)
- [x] Frontend package.json has start script (`next start`)
- [ ] All dependencies are production-ready versions
- [ ] No dev-only packages in dependencies

### **Configuration Files Needed**
- [ ] `.gitignore` (updated for secrets)
- [ ] `railway.json` (Railway build config)
- [ ] `vercel.json` (Vercel config - optional)
- [ ] `.env.example` (environment template)
- [ ] `README.md` (deployment instructions)

### **API Keys & Secrets Required**
- [ ] Supabase credentials (production)
- [ ] OpenAI API key
- [ ] Anthropic API key
- [ ] Tavily API key (research)
- [ ] Cohere API key (reranking)
- [ ] Other optional keys (Brave, Firecrawl, etc.)

---

## 📦 Phase 1: GitHub Repository Setup

### **Step 1.1: Create GitHub Repository**

```bash
# Option A: Via GitHub Web UI
1. Go to https://github.com/new
2. Repository name: personal-ai-assistant (or your choice)
3. Description: "Multi-agent AI assistant with RAG, SQL, and research capabilities"
4. Visibility: Private (recommended) or Public
5. DO NOT initialize with README (we have one)
6. Click "Create repository"

# Option B: Via GitHub CLI (if installed)
gh repo create personal-ai-assistant --private --source=. --remote=origin
```

### **Step 1.2: Review .gitignore**

**Critical Files to Ignore:**
```bash
# Environment & Secrets
.env
.env.local
.env*.local
!.env.example

# Development
docs-dev/
backup_*/
node_modules/
dist/
build/
.next/

# Logs & Data
logs/
*.log
*.csv
test-data/

# OS & IDE
.DS_Store
.vscode/
.idea/

# Database dumps
*.sql.bak
*.dump
```

**Verify .gitignore is correct:**
```bash
cat .gitignore
```

### **Step 1.3: Verify No Secrets in Code**

**CRITICAL: Check for hardcoded secrets**
```bash
# Search for potential secrets
grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_* --exclude-dir=docs-dev
grep -r "api.*key.*=" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_* | grep -v ".example"
grep -r "password.*=" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_*

# Check for Supabase URLs/keys
grep -r "supabase.co" . --exclude-dir=node_modules --exclude-dir=.git | grep -v ".example"
```

**If found:** Replace with environment variables immediately!

### **Step 1.4: Initialize Git & Push**

```bash
# Navigate to project root
cd /Users/heathmaxwell/master_agent

# Check git status
git status

# Stage all files
git add .

# Commit (if this is initial commit)
git commit -m "feat: initial commit - personal AI assistant

- Multi-agent system (RAG, SQL, Research)
- Next.js 15 frontend with App Router
- Express.js backend with WebSocket support
- Supabase PostgreSQL with pgvector
- Hybrid search (semantic + keyword + reranking)
- Budget tracking and usage analytics
- Production-ready with comprehensive error handling"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/personal-ai-assistant.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### **Step 1.5: Verify Repository**

```bash
# Check remote
git remote -v

# Verify push
git log --oneline -n 5

# Visit repository in browser
open https://github.com/YOUR_USERNAME/personal-ai-assistant
```

### **Step 1.6: Configure Repository Settings (GitHub UI)**

1. **Go to Settings → General**
   - Set default branch to `main`
   - Enable "Automatically delete head branches" (for PRs)

2. **Go to Settings → Branches**
   - Add branch protection rule for `main`:
     - ✓ Require pull request reviews (optional, for teams)
     - ✓ Require status checks (once Railway/Vercel integrated)

3. **Go to Settings → Secrets and variables → Actions**
   - Add repository secrets (for CI/CD later):
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `OPENAI_API_KEY`
     - `ANTHROPIC_API_KEY`

---

## 🗄️ Phase 2: Supabase Production Database

### **Step 2.1: Create Production Supabase Project**

```bash
1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Project details:
   - Name: personal-ai-assistant-prod
   - Database Password: (generate strong password - SAVE THIS!)
   - Region: Choose closest to your users (e.g., us-east-1, eu-central-1)
   - Pricing Plan: Pro ($25/mo) or Free (limited resources)
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning
```

### **Step 2.2: Enable Required Extensions**

```sql
-- In Supabase SQL Editor, run:

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for keyword search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### **Step 2.3: Run Migrations**

**Option A: Via Supabase Dashboard (SQL Editor)**
```sql
-- Copy and paste each migration file from supabase/migrations/ in order:
-- 1. 20251027000000_initial_schema.sql
-- 2. 20251028000000_add_search_functions.sql
-- 3. 20251029000000_tabular_data_system.sql
-- 4. 20251031000000_add_document_title.sql
-- 5. 20251031000001_add_conversation_title.sql
-- 6. 20251101000000_add_sql_agent_schema.sql
-- 7. 20251102000000_graduate_research_system.sql
-- 8. 20251102000001_add_budget_settings.sql
```

**Option B: Via Supabase CLI (if installed)**
```bash
# Link to production project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### **Step 2.4: Verify Schema**

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- - conversations
-- - database_connections
-- - document_chunks
-- - documents
-- - messages
-- - sql_query_history
-- - research_projects
-- - research_sources
-- - usage_tracking
-- - user_settings

-- Verify pgvector is working
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check search function exists
SELECT proname FROM pg_proc WHERE proname = 'hybrid_search';
```

### **Step 2.5: Save Production Credentials**

```bash
# From Supabase Dashboard → Settings → API:
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJhbG...  (public key, safe for frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  (SECRET! Backend only)

# Save these for Railway and Vercel configuration
```

---

## 🚂 Phase 3: Railway Backend Deployment

### **Step 3.1: Create Railway Account & Project**

```bash
1. Go to https://railway.app/
2. Sign up / Log in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Authorize Railway to access your GitHub
6. Select repository: personal-ai-assistant
7. Select service to deploy: backend/
8. Click "Add variables" (we'll configure in next step)
```

### **Step 3.2: Create railway.json Configuration**

**Create `/Users/heathmaxwell/master_agent/backend/railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### **Step 3.3: Configure Environment Variables in Railway**

**Go to Railway Dashboard → Project → Variables**

**Add all required variables:**

```bash
# Database (Supabase Production)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  (from Phase 2)
SUPABASE_ANON_KEY=eyJhbG...

# AI Providers (REQUIRED)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Research Providers
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=...  (optional)
COHERE_API_KEY=...  (optional for reranking)
FIRECRAWL_API_KEY=fc-...  (optional)

# Application Config
NODE_ENV=production
PORT=4000  (Railway will override with $PORT)
FRONTEND_URL=${{Vercel.url}}  (we'll update this after Vercel deployment)

# Budget & Limits
MONTHLY_BUDGET_USD=10.00
MAX_FILE_SIZE_MB=100

# Security
CORS_ORIGINS=${{Vercel.url}}  (update after Vercel deployment)

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**IMPORTANT: Use Railway's "Seal" feature for sensitive keys**
- Click 3-dot menu on each secret variable
- Choose "Seal" - this hides the value in UI

### **Step 3.4: Configure Custom Domain (Optional)**

```bash
1. Railway Dashboard → Settings → Domains
2. Click "Generate Domain" for Railway-provided subdomain
   - You'll get: your-project.up.railway.app
3. Or add custom domain:
   - Add domain: api.yourdomain.com
   - Add CNAME record in your DNS:
     - Name: api
     - Value: your-project.up.railway.app
   - Wait for SSL certificate (automatic)
```

### **Step 3.5: Deploy Backend**

```bash
# Railway auto-deploys on push to main branch
# Manual deploy:
1. Railway Dashboard → Deployments
2. Click "Deploy"
3. Watch build logs
4. Wait for "Deployment successful"
5. Click deployment URL to test health endpoint
```

### **Step 3.6: Verify Backend Deployment**

```bash
# Test health endpoint
curl https://your-project.up.railway.app/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-03T...","version":"1.0.0"}

# Test WebSocket connection (from browser console)
const ws = new WebSocket('wss://your-project.up.railway.app');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### **Step 3.7: Configure Railway Monitoring**

```bash
# Railway Dashboard → Observability
1. Enable "Health Checks":
   - Path: /health
   - Interval: 60 seconds
   - Timeout: 10 seconds

2. Set up "Alerts":
   - Deployment failures → Email
   - Memory usage > 80% → Email
   - Crashes → Email
```

---

## ▲ Phase 4: Vercel Frontend Deployment

### **Step 4.1: Create Vercel Account & Import Project**

```bash
1. Go to https://vercel.com/
2. Sign up / Log in with GitHub
3. Click "Add New" → "Project"
4. Import Git Repository:
   - Select: personal-ai-assistant
5. Configure Project:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: frontend
   - Build Command: npm run build (auto-detected)
   - Output Directory: .next (auto-detected)
6. DON'T deploy yet - configure environment variables first
```

### **Step 4.2: Configure Environment Variables in Vercel**

**Go to Project Settings → Environment Variables**

**Add variables for all environments (Production, Preview, Development):**

```bash
# Supabase (Public keys - safe for frontend)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...  (anon key, not service role!)

# Backend API (Railway URL from Phase 3)
NEXT_PUBLIC_API_URL=https://your-project.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-project.up.railway.app

# Environment
NODE_ENV=production
```

**IMPORTANT Notes:**
- ✅ Use `NEXT_PUBLIC_` prefix for client-side variables
- ✅ Only use ANON key for Supabase (never service role key!)
- ✅ Railway URL must be HTTPS/WSS for production

### **Step 4.3: Update next.config.ts for Production**

**Create `/Users/heathmaxwell/master_agent/frontend/next.config.ts`:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better debugging
  reactStrictMode: true,

  // Optimize images (if using Next Image)
  images: {
    domains: [
      'YOUR_PROJECT_REF.supabase.co', // Supabase storage
    ],
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### **Step 4.4: Deploy Frontend**

```bash
# Vercel auto-deploys on push to main branch
# Initial deploy:
1. Vercel Dashboard → Deploy
2. Watch build logs
3. Wait for "Deployment successful"
4. Click "Visit" to test deployment
5. You'll get URL: your-project.vercel.app
```

### **Step 4.5: Configure Custom Domain (Optional)**

```bash
1. Vercel Dashboard → Settings → Domains
2. Add domain:
   - Add: yourdomain.com
   - Add DNS records:
     - Type: A
     - Name: @
     - Value: 76.76.21.21 (Vercel IP)
   - Or CNAME:
     - Name: www
     - Value: cname.vercel-dns.com
3. Wait for SSL certificate (automatic)
4. Set as primary domain
```

### **Step 4.6: Update Backend CORS Configuration**

**After Vercel deployment, update Railway environment variables:**

```bash
# Railway Dashboard → Variables → Update:
FRONTEND_URL=https://your-project.vercel.app
CORS_ORIGINS=https://your-project.vercel.app,https://yourdomain.com

# Redeploy backend to apply changes
```

### **Step 4.7: Verify Frontend Deployment**

```bash
# Test in browser:
1. Visit https://your-project.vercel.app
2. Try signup/login
3. Test chat functionality
4. Test document upload
5. Test database connections
6. Check browser console for errors
```

---

## 🔧 Phase 5: Post-Deployment Configuration

### **Step 5.1: Update Repository with Deployment URLs**

**Update README.md with production URLs:**
```markdown
## 🌐 Live Demo

- **Frontend:** https://your-project.vercel.app
- **Backend API:** https://your-project.up.railway.app
- **Status:** https://your-project.up.railway.app/health
```

**Commit and push:**
```bash
git add README.md
git commit -m "docs: add production deployment URLs"
git push origin main
```

### **Step 5.2: Configure Webhooks (Optional)**

**Railway Webhook for Slack/Discord notifications:**
```bash
1. Railway Dashboard → Settings → Webhooks
2. Add webhook URL (e.g., Slack incoming webhook)
3. Select events: deployment.success, deployment.failed
```

**Vercel Webhook:**
```bash
1. Vercel Dashboard → Settings → Git → Deploy Hooks
2. Create hook for manual deploys
3. Save webhook URL
```

### **Step 5.3: Set Up Automated Backups**

**Supabase Database Backups:**
```bash
1. Supabase Dashboard → Database → Backups
2. Enable "Point-in-time Recovery" (Pro plan)
3. Or configure automated pg_dump:
   - Use GitHub Actions to run daily backups
   - Store in private S3 bucket or GitHub repo
```

### **Step 5.4: Configure Error Tracking (Recommended)**

**Option A: Sentry**
```bash
# Install Sentry
npm install @sentry/node @sentry/nextjs

# Configure in backend/src/index.ts and frontend
# Add SENTRY_DSN to environment variables
```

**Option B: LogRocket / Datadog / New Relic**

### **Step 5.5: Set Up Uptime Monitoring**

**Recommended Services:**
- UptimeRobot (free tier available)
- Pingdom
- Better Uptime

**Configuration:**
```bash
1. Monitor https://your-project.up.railway.app/health
2. Check interval: 5 minutes
3. Alert on: Down, Slow response (>2s)
4. Notification: Email, SMS, Slack
```

---

## ✅ Phase 6: Testing & Validation

### **Step 6.1: End-to-End Testing Checklist**

**Authentication:**
- [ ] User signup works
- [ ] Email verification works (if enabled)
- [ ] User login works
- [ ] Password reset works
- [ ] Session persistence works
- [ ] Logout works

**Chat Functionality:**
- [ ] Create new conversation
- [ ] Send message
- [ ] Receive streaming response
- [ ] WebSocket connection stable
- [ ] Conversation history loads
- [ ] Switch between conversations

**Document Upload & RAG:**
- [ ] Upload PDF document
- [ ] Upload text document
- [ ] Upload CSV/Excel file
- [ ] Processing completes successfully
- [ ] View documents in Knowledge Base
- [ ] Ask RAG query returns relevant results
- [ ] Citations display correctly
- [ ] Delete document works

**SQL Database Integration:**
- [ ] Add database connection
- [ ] Test connection succeeds
- [ ] Ask natural language SQL query
- [ ] Generated SQL is correct
- [ ] Query executes successfully
- [ ] Results display in table view
- [ ] Delete connection works

**Research Functionality:**
- [ ] Start research project
- [ ] Progress updates display
- [ ] Research completes
- [ ] Report downloads successfully
- [ ] Citations are formatted correctly

**Settings & Usage:**
- [ ] View usage dashboard
- [ ] Budget tracking displays correctly
- [ ] Update settings (model preferences)
- [ ] Budget warnings work at 80%

**Error Handling:**
- [ ] Budget exceeded blocks requests
- [ ] Invalid file type shows error
- [ ] Network errors display gracefully
- [ ] WebSocket reconnects after disconnect

### **Step 6.2: Performance Testing**

```bash
# Load testing (optional)
# Use tools like Apache JMeter, k6, or Artillery

# Example: Test concurrent users
k6 run load-test.js --vus 10 --duration 30s
```

### **Step 6.3: Security Audit**

**Checklist:**
- [ ] No secrets in client-side code (check browser DevTools)
- [ ] All API endpoints require authentication
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (React escapes by default)
- [ ] File upload limits enforced
- [ ] HTTPS/WSS only (no HTTP in production)

---

## 📊 Phase 7: Monitoring & Maintenance

### **Step 7.1: Set Up Dashboards**

**Railway Monitoring:**
- CPU usage
- Memory usage
- Request count
- Response time
- Error rate

**Vercel Analytics:**
- Page views
- Core Web Vitals
- Error tracking
- Build times

**Supabase Monitoring:**
- Database size
- Connection pool usage
- Query performance
- API request count

### **Step 7.2: Regular Maintenance Tasks**

**Daily:**
- [ ] Check error logs
- [ ] Monitor uptime status
- [ ] Review usage metrics

**Weekly:**
- [ ] Review cost spending
- [ ] Check database size growth
- [ ] Review slow queries

**Monthly:**
- [ ] Rotate API keys (security best practice)
- [ ] Review and archive old data
- [ ] Update dependencies
- [ ] Review and optimize costs

---

## ↩️ Rollback Plan

### **If Backend Deployment Fails:**

```bash
# Option 1: Rollback via Railway Dashboard
1. Railway Dashboard → Deployments
2. Find last working deployment
3. Click "Redeploy"

# Option 2: Rollback via Git
git revert HEAD
git push origin main
```

### **If Frontend Deployment Fails:**

```bash
# Option 1: Rollback via Vercel Dashboard
1. Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "Promote to Production"

# Option 2: Rollback via Git
git revert HEAD
git push origin main
```

### **If Database Migration Fails:**

```bash
# Restore from backup
1. Supabase Dashboard → Database → Backups
2. Select backup before migration
3. Click "Restore"

# Or restore via pg_restore
pg_restore -h db.YOUR_PROJECT_REF.supabase.co -U postgres -d postgres backup.dump
```

---

## 💰 Cost Estimation

### **Monthly Costs:**

**Railway (Backend):**
- Hobby Plan: $5/month (512MB RAM, 1GB storage)
- Pro Plan: $20/month (8GB RAM, 100GB storage)
- Estimate: **$5-20/month** (depending on traffic)

**Vercel (Frontend):**
- Hobby: $0/month (100GB bandwidth, unlimited deployments)
- Pro: $20/month (1TB bandwidth, advanced features)
- Estimate: **$0-20/month**

**Supabase (Database):**
- Free: $0/month (500MB database, 1GB file storage)
- Pro: $25/month (8GB database, 100GB file storage)
- Estimate: **$0-25/month**

**AI API Costs (Variable):**
- OpenAI (embeddings + GPT): ~$5-50/month
- Anthropic (Claude): ~$10-100/month
- Cohere (reranking): ~$0-10/month
- Tavily (research): ~$0-20/month
- Estimate: **$15-180/month** (depends on usage)

**Total Estimated Monthly Cost:**
- **Minimum (Free tiers):** $20-30/month (AI APIs only)
- **Recommended (Pro plans):** $80-200/month
- **Heavy usage:** $200-500/month

**Tips to Reduce Costs:**
- Use free tiers during development
- Implement aggressive budget limits ($10/user/month)
- Cache frequently requested data
- Optimize LLM prompts to reduce token usage
- Use cheaper models where appropriate (GPT-3.5 vs GPT-4)

---

## 📚 Additional Resources

**Railway Documentation:**
- https://docs.railway.app/
- https://docs.railway.app/guides/nodejs

**Vercel Documentation:**
- https://vercel.com/docs
- https://nextjs.org/docs/deployment

**Supabase Documentation:**
- https://supabase.com/docs
- https://supabase.com/docs/guides/database/overview

**GitHub Actions (CI/CD):**
- https://docs.github.com/en/actions

---

## ✅ Deployment Completion Checklist

**Pre-Deployment:**
- [ ] Code cleanup complete
- [ ] All tests passing
- [ ] Environment variables documented
- [ ] Secrets removed from code
- [ ] .gitignore configured

**Phase 1: GitHub**
- [ ] Repository created
- [ ] Code pushed to main branch
- [ ] Repository settings configured
- [ ] No secrets in code verified

**Phase 2: Database**
- [ ] Supabase production project created
- [ ] Extensions enabled (pgvector, pg_trgm)
- [ ] Migrations applied successfully
- [ ] Schema verified
- [ ] Credentials saved

**Phase 3: Backend (Railway)**
- [ ] Railway project created
- [ ] railway.json configured
- [ ] Environment variables set
- [ ] Sensitive variables sealed
- [ ] Backend deployed successfully
- [ ] Health endpoint tested
- [ ] WebSocket tested

**Phase 4: Frontend (Vercel)**
- [ ] Vercel project created
- [ ] Environment variables set
- [ ] next.config.ts updated
- [ ] Frontend deployed successfully
- [ ] Application tested in browser

**Phase 5: Post-Deployment**
- [ ] README updated with URLs
- [ ] Backend CORS updated
- [ ] Webhooks configured (optional)
- [ ] Backups enabled
- [ ] Error tracking configured

**Phase 6: Testing**
- [ ] End-to-end tests passing
- [ ] Performance acceptable
- [ ] Security audit complete

**Phase 7: Monitoring**
- [ ] Uptime monitoring active
- [ ] Dashboards configured
- [ ] Alerts set up

---

**Status:** Ready for deployment
**Last Updated:** November 3, 2025
**Deployment Method:** GitHub → Railway (Backend) + Vercel (Frontend)
