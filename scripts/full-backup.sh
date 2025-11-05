#!/bin/bash
###############################################################################
# Full Backup Script for Master Agent
# Backs up: Git repository, Database, Environment variables, Documentation
###############################################################################

set -e  # Exit on error

# Configuration
BACKUP_ROOT="$HOME/master_agent_backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/full-backup-$TIMESTAMP"
PROJECT_DIR="/Users/heathmaxwell/master_agent"

echo "🚀 Starting full backup of Master Agent..."
echo "📁 Backup location: $BACKUP_DIR"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

#-----------------------------------------------------------------------------
# 1. Git Repository Backup
#-----------------------------------------------------------------------------
echo "📦 [1/4] Backing up Git repository..."
cd "$PROJECT_DIR"
git bundle create "$BACKUP_DIR/master_agent.bundle" --all
echo "✅ Git repository backed up"
echo ""

#-----------------------------------------------------------------------------
# 2. Database Backup
#-----------------------------------------------------------------------------
echo "💾 [2/4] Backing up database..."
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set"
  echo "   Skipping database backup"
  echo "   Set the key and run: node scripts/backup-database.mjs"
else
  cd "$PROJECT_DIR/backend"
  node backup-database.mjs
  # Move database backup into this full backup
  LATEST_DB_BACKUP=$(ls -td "$BACKUP_ROOT"/db-backup-* | head -1)
  if [ -n "$LATEST_DB_BACKUP" ]; then
    mv "$LATEST_DB_BACKUP" "$BACKUP_DIR/database"
    echo "✅ Database backed up"
  fi
fi
echo ""

#-----------------------------------------------------------------------------
# 3. Environment Variables Backup
#-----------------------------------------------------------------------------
echo "🔐 [3/4] Backing up environment configuration..."
mkdir -p "$BACKUP_DIR/env"

# Backend environment variables (sanitized - no actual secrets)
cat > "$BACKUP_DIR/env/backend-env-template.txt" << 'EOF'
# Backend Environment Variables (Template)
# Fill in actual values from Railway dashboard

SUPABASE_URL=https://omjwoyyhpdawjxsbpamc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[GET_FROM_SUPABASE]

OPENAI_API_KEY=[GET_FROM_OPENAI]
ANTHROPIC_API_KEY=[GET_FROM_ANTHROPIC]
COHERE_API_KEY=[GET_FROM_COHERE]

CORS_ORIGINS=https://master-agent-sage.vercel.app
PORT=3001
MONTHLY_BUDGET_USD=10.00
EOF

# Frontend environment variables (public keys are safe to backup)
cat > "$BACKUP_DIR/env/frontend-env-template.txt" << 'EOF'
# Frontend Environment Variables (Template)

NEXT_PUBLIC_API_URL=https://masteragent-production-9a9b.up.railway.app
NEXT_PUBLIC_WS_URL=wss://masteragent-production-9a9b.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://omjwoyyhpdawjxsbpamc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[GET_FROM_SUPABASE]
EOF

echo "✅ Environment configuration templates saved"
echo ""

#-----------------------------------------------------------------------------
# 4. Documentation & Metadata
#-----------------------------------------------------------------------------
echo "📄 [4/4] Backing up documentation and metadata..."
mkdir -p "$BACKUP_DIR/docs"

# Copy important documentation
cp "$PROJECT_DIR/README.md" "$BACKUP_DIR/docs/" 2>/dev/null || echo "   No README.md"
cp "$PROJECT_DIR/PHASE_8_COMPLETE.md" "$BACKUP_DIR/docs/" 2>/dev/null || true
cp "$PROJECT_DIR/ERROR_LOGGING_SUMMARY.md" "$BACKUP_DIR/docs/" 2>/dev/null || true
cp "$PROJECT_DIR/RAG_ONLY_MODE_FIX.md" "$BACKUP_DIR/docs/" 2>/dev/null || true

# Create backup manifest
cat > "$BACKUP_DIR/BACKUP_MANIFEST.md" << EOF
# Master Agent Backup Manifest

**Backup Date:** $(date)
**Backup Location:** $BACKUP_DIR

## Contents

### 1. Git Repository
- File: \`master_agent.bundle\`
- Contains: Full git history and all code

### 2. Database
- Location: \`database/\`
- Tables backed up:
  - documents
  - document_chunks
  - conversations
  - messages
  - user_usage
  - database_connections
  - sql_query_history

### 3. Environment Variables
- Location: \`env/\`
- Files:
  - \`backend-env-template.txt\` - Backend configuration
  - \`frontend-env-template.txt\` - Frontend configuration

### 4. Documentation
- Location: \`docs/\`
- Contains: Project documentation and setup guides

## How to Restore

### Restore Git Repository
\`\`\`bash
git clone master_agent.bundle master_agent_restored
cd master_agent_restored
git remote set-url origin https://github.com/maxha7766/master_agent.git
\`\`\`

### Restore Database
\`\`\`bash
# Use the backup-database.mjs script in reverse
# Or manually import JSON files to Supabase
\`\`\`

### Restore Environment Variables
1. Copy values from \`env/\` templates
2. Set in Railway dashboard (backend)
3. Set in Vercel dashboard (frontend)

## Deployment URLs
- Frontend: https://master-agent-sage.vercel.app
- Backend: https://masteragent-production-9a9b.up.railway.app
- Supabase: https://omjwoyyhpdawjxsbpamc.supabase.co

## Git Information
- Repository: https://github.com/maxha7766/master_agent
- Current Branch: $(cd "$PROJECT_DIR" && git branch --show-current)
- Latest Commit: $(cd "$PROJECT_DIR" && git log -1 --oneline)
EOF

echo "✅ Documentation backed up"
echo ""

#-----------------------------------------------------------------------------
# Summary
#-----------------------------------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BACKUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Backup Location:"
echo "   $BACKUP_DIR"
echo ""
echo "📦 Backup Size:"
du -sh "$BACKUP_DIR"
echo ""
echo "📋 Contents:"
ls -lh "$BACKUP_DIR"
echo ""
echo "💡 To restore, see: $BACKUP_DIR/BACKUP_MANIFEST.md"
echo ""
