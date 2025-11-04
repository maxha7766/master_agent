# 🚀 Quick Start Deployment Guide

**Time to Deploy:** ~30 minutes
**Skill Level:** Intermediate
**Cost:** $20-80/month (depending on usage)

---

## 📋 Prerequisites

Before you begin, have these ready:

- [ ] GitHub account
- [ ] Railway account (sign up at https://railway.app)
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Supabase account (sign up at https://supabase.com)
- [ ] OpenAI API key (https://platform.openai.com/api-keys)
- [ ] Anthropic API key (https://console.anthropic.com/)
- [ ] Tavily API key (https://tavily.com)

---

## ⚡ 5-Step Deployment (30 minutes)

### Step 1: Push to GitHub (5 min)

```bash
# In project root
cd /Users/heathmaxwell/master_agent

# Review and update .gitignore
cat .gitignore

# Check for secrets (should return nothing)
grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=.git

# Create GitHub repo (via web or CLI)
# Web: https://github.com/new
# Name: personal-ai-assistant
# Visibility: Private

# Push code
git remote add origin https://github.com/YOUR_USERNAME/personal-ai-assistant.git
git branch -M main
git push -u origin main
```

---

### Step 2: Set Up Supabase Database (10 min)

```bash
1. Go to https://supabase.com/dashboard
2. Click "New project"
   - Name: personal-ai-assistant-prod
   - Region: Choose closest to you
   - Database Password: Generate strong password (SAVE IT!)
3. Wait for project creation (~2 min)
4. Go to SQL Editor
5. Copy and paste these commands:

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

6. Go to SQL Editor → Run each migration file from supabase/migrations/ in order:
   - 20251027000000_initial_schema.sql
   - 20251028000000_add_search_functions.sql
   - 20251029000000_tabular_data_system.sql
   - 20251031000000_add_document_title.sql
   - 20251031000001_add_conversation_title.sql
   - 20251101000000_add_sql_agent_schema.sql
   - 20251102000000_graduate_research_system.sql
   - 20251102000001_add_budget_settings.sql

7. Go to Settings → API
   - Copy SUPABASE_URL
   - Copy SUPABASE_ANON_KEY (public)
   - Copy SUPABASE_SERVICE_ROLE_KEY (secret!)
```

---

### Step 3: Deploy Backend to Railway (8 min)

```bash
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Authorize Railway → Select your repository
4. Railway will detect both frontend and backend
5. Deploy ONLY the backend first:
   - Click "backend" service
   - Go to "Variables" tab
   - Add these variables:

   # Database
   SUPABASE_URL=<from Step 2>
   SUPABASE_SERVICE_ROLE_KEY=<from Step 2>
   SUPABASE_ANON_KEY=<from Step 2>

   # AI APIs
   OPENAI_API_KEY=sk-proj-your-key
   ANTHROPIC_API_KEY=sk-ant-your-key
   TAVILY_API_KEY=tvly-your-key

   # Config
   NODE_ENV=production
   PORT=4000
   LOG_LEVEL=info
   MONTHLY_BUDGET_USD=10.00

6. Click "Deploy" (wait ~3 min)
7. Once deployed, copy the URL (e.g., backend-production-abc.up.railway.app)
8. Test: Visit https://your-backend-url.up.railway.app/health
   - Should return: {"status":"ok",...}
```

---

### Step 4: Deploy Frontend to Vercel (5 min)

```bash
1. Go to https://vercel.com/new
2. Import Git Repository → Select personal-ai-assistant
3. Configure project:
   - Framework Preset: Next.js ✓ (auto-detected)
   - Root Directory: frontend
   - Build Command: npm run build
   - Output Directory: .next

4. Environment Variables (click "Add"):

   NEXT_PUBLIC_SUPABASE_URL=<from Step 2>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Step 2>
   NEXT_PUBLIC_API_URL=https://your-backend-url.up.railway.app
   NEXT_PUBLIC_WS_URL=wss://your-backend-url.up.railway.app
   NODE_ENV=production

   - Environment: Production, Preview, Development (check all)

5. Click "Deploy" (wait ~2 min)
6. Once deployed, you'll get: https://your-project.vercel.app
7. Test: Visit your Vercel URL, try signing up
```

---

### Step 5: Final Configuration (2 min)

```bash
1. Update Railway backend CORS:
   - Go to Railway → backend service → Variables
   - Add/Update:
     FRONTEND_URL=https://your-project.vercel.app
     CORS_ORIGINS=https://your-project.vercel.app
   - Click "Redeploy"

2. Test full flow:
   - Visit https://your-project.vercel.app
   - Sign up for an account
   - Send a chat message
   - Upload a document
   - Verify everything works!
```

---

## ✅ Success! You're Deployed!

**Your URLs:**
- Frontend: https://your-project.vercel.app
- Backend: https://your-backend.up.railway.app
- Database: Supabase Dashboard

**Next Steps:**
1. ⭐ Star the GitHub repo
2. 📊 Set up monitoring (see DEPLOYMENT_PLAN.md Phase 7)
3. 🔒 Enable 2FA on all accounts (GitHub, Railway, Vercel, Supabase)
4. 💰 Set up budget alerts in Railway/Vercel
5. 📧 Configure custom domain (optional, see DEPLOYMENT_PLAN.md Phase 4.5)

---

## 🚨 Troubleshooting

### Backend deployment fails
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure Supabase migrations ran successfully

### Frontend can't connect to backend
- Verify NEXT_PUBLIC_API_URL is correct (must be HTTPS)
- Check CORS_ORIGINS includes your Vercel URL
- Test backend health endpoint manually

### WebSocket connection fails
- Verify NEXT_PUBLIC_WS_URL uses `wss://` (not `ws://`)
- Check Railway supports WebSocket (it does!)
- Test WebSocket manually with browser DevTools

### "Budget exceeded" error
- Update MONTHLY_BUDGET_USD in Railway
- Check usage in /usage dashboard
- Budget resets 1st of each month

---

## 📞 Support

- Full deployment guide: `DEPLOYMENT_PLAN.md`
- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs

---

**🎉 Congratulations on deploying your AI assistant!**
