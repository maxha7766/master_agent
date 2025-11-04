#!/bin/bash

##############################################################################
# PROJECT CLEANUP SCRIPT
# Reorganizes development files into proper directory structure
#
# What this does:
# - Creates organized directory structure (docs/, docs-dev/, scripts/)
# - Moves test/debug scripts to scripts/dev/
# - Moves migration scripts to scripts/migrations/
# - Moves admin scripts to scripts/admin/
# - Archives development documentation to docs-dev/
# - Deletes obsolete files (duplicate migrations, test data)
# - Removes empty directories
#
# Safety: Creates backup before making changes
##############################################################################

set -e  # Exit on error

echo "🧹 Personal AI Assistant - Project Cleanup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}Current directory: ${SCRIPT_DIR}${NC}"
echo ""

# Confirmation prompt
echo -e "${YELLOW}⚠️  This script will reorganize your project files.${NC}"
echo -e "${YELLOW}⚠️  A backup will be created before making changes.${NC}"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

##############################################################################
# STEP 1: CREATE BACKUP
##############################################################################

echo ""
echo -e "${BLUE}Step 1: Creating backup...${NC}"

BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup all files we're about to move/delete
echo "  Creating backup in: $BACKUP_DIR"
cp -R backend/*.{mjs,js,md} "$BACKUP_DIR/" 2>/dev/null || true
cp *.{md,sql,mjs,js,csv,sh} "$BACKUP_DIR/" 2>/dev/null || true

echo -e "${GREEN}  ✓ Backup created${NC}"

##############################################################################
# STEP 2: CREATE NEW DIRECTORY STRUCTURE
##############################################################################

echo ""
echo -e "${BLUE}Step 2: Creating new directory structure...${NC}"

mkdir -p docs
mkdir -p docs-dev
mkdir -p scripts/dev
mkdir -p scripts/migrations
mkdir -p scripts/admin
mkdir -p backend/tests

echo -e "${GREEN}  ✓ Directories created${NC}"

##############################################################################
# STEP 3: MOVE DEVELOPMENT DOCUMENTATION
##############################################################################

echo ""
echo -e "${BLUE}Step 3: Moving development documentation to docs-dev/...${NC}"

# Root dev docs
mv ERROR_LOGGING_SUMMARY.md docs-dev/ 2>/dev/null && echo "  - Moved ERROR_LOGGING_SUMMARY.md" || true
mv PHASE_8_COMPLETE.md docs-dev/ 2>/dev/null && echo "  - Moved PHASE_8_COMPLETE.md" || true
mv RAG_ONLY_MODE_FIX.md docs-dev/ 2>/dev/null && echo "  - Moved RAG_ONLY_MODE_FIX.md" || true
mv SQL_AGENT_SETUP.md docs-dev/ 2>/dev/null && echo "  - Moved SQL_AGENT_SETUP.md" || true

# Backend dev docs
mv backend/ERROR_LOGGING_AUDIT.md docs-dev/ 2>/dev/null && echo "  - Moved ERROR_LOGGING_AUDIT.md" || true
mv backend/GRADUATE_RESEARCH_PROGRESS.md docs-dev/ 2>/dev/null && echo "  - Moved GRADUATE_RESEARCH_PROGRESS.md" || true
mv backend/RAG_DEBUG_REPORT.md docs-dev/ 2>/dev/null && echo "  - Moved RAG_DEBUG_REPORT.md" || true
mv backend/SQL_AGENT_SUMMARY.md docs-dev/ 2>/dev/null && echo "  - Moved SQL_AGENT_SUMMARY.md" || true
mv backend/TABULAR_IMPLEMENTATION_STATUS.md docs-dev/ 2>/dev/null && echo "  - Moved TABULAR_IMPLEMENTATION_STATUS.md" || true
mv backend/UPDATE_FUNCTIONS.md docs-dev/ 2>/dev/null && echo "  - Moved UPDATE_FUNCTIONS.md" || true
mv backend/SETUP_INSTRUCTIONS.md docs-dev/ 2>/dev/null && echo "  - Moved SETUP_INSTRUCTIONS.md" || true

echo -e "${GREEN}  ✓ Development docs moved${NC}"

##############################################################################
# STEP 4: MOVE TEST SCRIPTS
##############################################################################

echo ""
echo -e "${BLUE}Step 4: Moving test scripts to scripts/dev/...${NC}"

# Move all test-*.mjs files from backend
find backend -maxdepth 1 -name "test-*.mjs" -exec mv {} scripts/dev/ \; 2>/dev/null
find backend -maxdepth 1 -name "test-*.js" -exec mv {} scripts/dev/ \; 2>/dev/null

# Move all check-*.mjs files from backend
find backend -maxdepth 1 -name "check-*.mjs" -exec mv {} scripts/dev/ \; 2>/dev/null
find backend -maxdepth 1 -name "check-*.js" -exec mv {} scripts/dev/ \; 2>/dev/null

# Move debug scripts
mv backend/debug-*.mjs scripts/dev/ 2>/dev/null || true
mv backend/investigate-*.mjs scripts/dev/ 2>/dev/null || true
mv backend/reload-schema-and-test.mjs scripts/dev/ 2>/dev/null || true

# Move root test scripts
mv test-*.js scripts/dev/ 2>/dev/null || true
mv test-*.mjs scripts/dev/ 2>/dev/null || true

echo -e "${GREEN}  ✓ Test scripts moved ($(ls scripts/dev/*.{mjs,js} 2>/dev/null | wc -l | xargs) files)${NC}"

##############################################################################
# STEP 5: MOVE MIGRATION SCRIPTS
##############################################################################

echo ""
echo -e "${BLUE}Step 5: Moving migration scripts to scripts/migrations/...${NC}"

# Move migration runners from backend
mv backend/apply-*.mjs scripts/migrations/ 2>/dev/null || true
mv backend/run-*.mjs scripts/migrations/ 2>/dev/null || true
mv backend/add-*.mjs scripts/migrations/ 2>/dev/null || true
mv backend/fix-*.mjs scripts/migrations/ 2>/dev/null || true
mv backend/migrate-*.mjs scripts/migrations/ 2>/dev/null || true

# Move migration runners from root
mv apply-*.mjs scripts/migrations/ 2>/dev/null || true
mv run-*.js scripts/migrations/ 2>/dev/null || true
mv fix-*.js scripts/migrations/ 2>/dev/null || true

echo -e "${GREEN}  ✓ Migration scripts moved ($(ls scripts/migrations/*.{mjs,js} 2>/dev/null | wc -l | xargs) files)${NC}"

##############################################################################
# STEP 6: MOVE ADMIN SCRIPTS
##############################################################################

echo ""
echo -e "${BLUE}Step 6: Moving admin scripts to scripts/admin/...${NC}"

# Move admin scripts from backend
mv backend/delete-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/clean-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/clean-*.js scripts/admin/ 2>/dev/null || true
mv backend/transfer-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/verify-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/update-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/reprocess-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/create-tables-via-api.mjs scripts/admin/ 2>/dev/null || true
mv backend/create-search-function-directly.mjs scripts/admin/ 2>/dev/null || true
mv backend/reset-password.js scripts/admin/ 2>/dev/null || true

echo -e "${GREEN}  ✓ Admin scripts moved ($(ls scripts/admin/*.{mjs,js} 2>/dev/null | wc -l | xargs) files)${NC}"

##############################################################################
# STEP 7: MOVE UTILITY SCRIPTS
##############################################################################

echo ""
echo -e "${BLUE}Step 7: Moving utility scripts to scripts/admin/...${NC}"

mv backend/get-*.mjs scripts/admin/ 2>/dev/null || true
mv backend/save-*.mjs scripts/admin/ 2>/dev/null || true

echo -e "${GREEN}  ✓ Utility scripts moved${NC}"

##############################################################################
# STEP 8: DELETE OBSOLETE FILES
##############################################################################

echo ""
echo -e "${BLUE}Step 8: Deleting obsolete files...${NC}"

# Delete duplicate SQL migrations (already in supabase/migrations/)
rm -f add-file-hash-column.sql && echo "  - Deleted add-file-hash-column.sql" || true
rm -f add-metadata-column.sql && echo "  - Deleted add-metadata-column.sql" || true
rm -f add-sources-metadata.sql && echo "  - Deleted add-sources-metadata.sql" || true
rm -f apply-tabular-migration.sql && echo "  - Deleted apply-tabular-migration.sql" || true
rm -f create-database-connections-table.sql && echo "  - Deleted create-database-connections-table.sql" || true
rm -f create-exec-sql-function.sql && echo "  - Deleted create-exec-sql-function.sql" || true
rm -f create-sql-query-history-table.sql && echo "  - Deleted create-sql-query-history-table.sql" || true
rm -f update-database-connections-table.sql && echo "  - Deleted update-database-connections-table.sql" || true

# Delete test data
rm -f test-sales-data.csv && echo "  - Deleted test-sales-data.csv" || true

# Delete generated research outputs from backend
rm -f backend/sec-football-report.md && echo "  - Deleted sec-football-report.md" || true
rm -f backend/sec-football-report-v2.md && echo "  - Deleted sec-football-report-v2.md" || true
rm -f backend/sec-football-history-complete.md && echo "  - Deleted sec-football-history-complete.md" || true
rm -f backend/sec_football_research.md && echo "  - Deleted sec_football_research.md" || true

# Delete obsolete deployment scripts
rm -f create-github-repo.sh && echo "  - Deleted create-github-repo.sh" || true
rm -f push-to-github.sh && echo "  - Deleted push-to-github.sh" || true

echo -e "${GREEN}  ✓ Obsolete files deleted${NC}"

##############################################################################
# STEP 9: CREATE README FILES
##############################################################################

echo ""
echo -e "${BLUE}Step 9: Creating README files for new directories...${NC}"

# scripts/dev/README.md
cat > scripts/dev/README.md << 'EOF'
# Development Scripts

This directory contains scripts used during development for testing, debugging, and verification.

## Categories

### Test Scripts (`test-*.mjs`)
Integration and E2E tests for various system components.

**Usage:**
```bash
node scripts/dev/test-rag-flow.mjs
node scripts/dev/test-sql-agent.mjs
```

### Check Scripts (`check-*.mjs`)
Database verification and schema checking utilities.

**Usage:**
```bash
node scripts/dev/check-db-state.mjs
node scripts/dev/check-chunks-table.mjs
```

### Debug Scripts (`debug-*.mjs`)
Debugging utilities for troubleshooting issues.

## Requirements

- Node.js 20+
- `.env` file configured in backend/
- Supabase database accessible

## Notes

⚠️ These scripts are for development only and should not be run in production.
EOF

# scripts/migrations/README.md
cat > scripts/migrations/README.md << 'EOF'
# Migration Scripts

One-off migration scripts for database schema updates and data transformations.

## Usage

These scripts are typically run once to migrate data or apply schema changes:

```bash
node scripts/migrations/apply-budget-migration.mjs
node scripts/migrations/run-graduate-migration.mjs
```

## Official Migrations

For versioned migrations, see `supabase/migrations/` directory.

Official migration order:
1. `20251027000000_initial_schema.sql`
2. `20251028000000_add_search_functions.sql`
3. `20251029000000_tabular_data_system.sql`
4. `20251031000000_add_document_title.sql`
5. `20251031000001_add_conversation_title.sql`
6. `20251101000000_add_sql_agent_schema.sql`
7. `20251102000000_graduate_research_system.sql`
8. `20251102000001_add_budget_settings.sql`

## Notes

⚠️ Migration scripts should only be run by developers who understand the schema changes.
EOF

# scripts/admin/README.md
cat > scripts/admin/README.md << 'EOF'
# Admin Scripts

Administrative utilities for database maintenance and user management.

## Scripts

### Data Management
- `delete-*.mjs` - Delete documents and data
- `clean-*.mjs` - Clean up orphaned records
- `transfer-*.mjs` - Transfer data between users
- `verify-*.mjs` - Verify data integrity

### User Management
- `reset-password.js` - Reset user passwords

## Usage

```bash
node scripts/admin/clean-documents.mjs
node scripts/admin/reset-password.js user@example.com
```

## Safety

⚠️ **DANGER**: These scripts modify production data. Always:
1. Create a backup before running
2. Test on development database first
3. Verify the script targets correct records
4. Have a rollback plan

## Requirements

- Admin access to Supabase
- `SUPABASE_SERVICE_ROLE_KEY` in `.env`
EOF

# docs-dev/README.md
cat > docs-dev/README.md << 'EOF'
# Development Documentation

This directory contains development notes, progress reports, and debugging documentation created during the project development.

## Contents

- **Progress Reports**: Phase completion summaries
- **Debug Reports**: Issue investigation and resolution notes
- **Setup Guides**: Feature-specific setup instructions
- **Implementation Notes**: Technical decisions and learnings

## Note

📝 These are development artifacts and may contain outdated information. For current documentation, see the main `docs/` directory.
EOF

echo -e "${GREEN}  ✓ README files created${NC}"

##############################################################################
# STEP 10: CLEAN EMPTY DIRECTORIES
##############################################################################

echo ""
echo -e "${BLUE}Step 10: Cleaning empty directories...${NC}"

# Remove empty frontend/src if it exists and only contains store/
if [ -d "frontend/src" ]; then
    # Check if only store/ exists or if it's empty
    if [ -z "$(ls -A frontend/src | grep -v '^store$')" ]; then
        echo "  - Keeping frontend/src/store/ (Zustand stores)"
    fi
fi

# Find and remove other empty directories (but keep important ones)
find backend -maxdepth 1 -type d -empty -delete 2>/dev/null || true

echo -e "${GREEN}  ✓ Empty directories cleaned${NC}"

##############################################################################
# STEP 11: UPDATE .gitignore
##############################################################################

echo ""
echo -e "${BLUE}Step 11: Updating .gitignore...${NC}"

# Backup existing .gitignore
cp .gitignore .gitignore.bak 2>/dev/null || true

# Add new entries if they don't exist
cat >> .gitignore << 'EOF'

# Development documentation (archived)
docs-dev/

# Backup directories
backup_*/

# Test data
test-data/
*.csv
test-*.txt

# Database dumps
*.sql.bak
*.dump

# Temporary files
*.tmp

# macOS
.DS_Store

# IDE
.vscode/
.idea/

# Logs
logs/
*.log
npm-debug.log*

# Environment
.env
.env.local
.env*.local
!.env.example
EOF

# Remove duplicates
sort -u .gitignore -o .gitignore

echo -e "${GREEN}  ✓ .gitignore updated${NC}"

##############################################################################
# STEP 12: CREATE .env.example FILES
##############################################################################

echo ""
echo -e "${BLUE}Step 12: Creating .env.example templates...${NC}"

# Check if .env.example already exists in root
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Research APIs (Optional)
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=...
COHERE_API_KEY=...

# Server
PORT=4000
NODE_ENV=development

# Budget (Optional, default $10/month)
MONTHLY_BUDGET_USD=10.00
EOF
    echo "  - Created .env.example in root"
fi

# Check if backend/.env.example exists
if [ ! -f "backend/.env.example" ]; then
    cp .env.example backend/.env.example 2>/dev/null || true
    echo "  - Created backend/.env.example"
fi

echo -e "${GREEN}  ✓ .env.example templates created${NC}"

##############################################################################
# SUMMARY
##############################################################################

echo ""
echo "=========================================="
echo -e "${GREEN}✅ CLEANUP COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  - Moved $(ls docs-dev/*.md 2>/dev/null | wc -l | xargs) dev docs to docs-dev/"
echo "  - Moved $(ls scripts/dev/*.{mjs,js} 2>/dev/null | wc -l | xargs) test scripts to scripts/dev/"
echo "  - Moved $(ls scripts/migrations/*.{mjs,js} 2>/dev/null | wc -l | xargs) migration scripts to scripts/migrations/"
echo "  - Moved $(ls scripts/admin/*.{mjs,js} 2>/dev/null | wc -l | xargs) admin scripts to scripts/admin/"
echo "  - Deleted obsolete files"
echo "  - Created documentation READMEs"
echo "  - Updated .gitignore"
echo ""
echo "📁 New Structure:"
echo "  ├── docs/              (production documentation)"
echo "  ├── docs-dev/          (development notes - gitignored)"
echo "  ├── scripts/"
echo "  │   ├── dev/          (test & debug scripts)"
echo "  │   ├── migrations/   (one-off migrations)"
echo "  │   └── admin/        (admin utilities)"
echo "  ├── backend/"
echo "  ├── frontend/"
echo "  └── supabase/"
echo ""
echo "💾 Backup saved to: ${BACKUP_DIR}/"
echo ""
echo "🔄 Next Steps:"
echo "  1. Review the changes"
echo "  2. Test that everything still works"
echo "  3. Commit: git add . && git commit -m 'chore: project cleanup and reorganization'"
echo "  4. Delete backup if satisfied: rm -rf ${BACKUP_DIR}"
echo ""
