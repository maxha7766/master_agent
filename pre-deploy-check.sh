#!/bin/bash

##############################################################################
# PRE-DEPLOYMENT VERIFICATION SCRIPT
# Checks if your project is ready for deployment to Railway + Vercel
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Personal AI Assistant - Pre-Deployment Check"
echo "================================================"
echo ""

ERRORS=0
WARNINGS=0

##############################################################################
# CHECK 1: Git Repository
##############################################################################

echo -e "${BLUE}[1/10] Checking Git repository...${NC}"

if [ -d ".git" ]; then
    echo -e "${GREEN}  ✓ Git repository initialized${NC}"
else
    echo -e "${RED}  ✗ Git repository not initialized${NC}"
    echo "    Run: git init"
    ((ERRORS++))
fi

if git remote get-url origin >/dev/null 2>&1; then
    REMOTE=$(git remote get-url origin)
    echo -e "${GREEN}  ✓ Git remote configured: $REMOTE${NC}"
else
    echo -e "${YELLOW}  ⚠ No git remote configured${NC}"
    echo "    You'll need to add this before deploying"
    ((WARNINGS++))
fi

##############################################################################
# CHECK 2: .gitignore
##############################################################################

echo ""
echo -e "${BLUE}[2/10] Checking .gitignore...${NC}"

if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore && grep -q "^node_modules" .gitignore; then
        echo -e "${GREEN}  ✓ .gitignore properly configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ .gitignore may be incomplete${NC}"
        echo "    Ensure it includes: .env, node_modules, .env.local"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}  ✗ .gitignore file missing${NC}"
    ((ERRORS++))
fi

##############################################################################
# CHECK 3: Environment Files
##############################################################################

echo ""
echo -e "${BLUE}[3/10] Checking environment configuration...${NC}"

if [ -f ".env.example" ]; then
    echo -e "${GREEN}  ✓ .env.example exists${NC}"
else
    echo -e "${YELLOW}  ⚠ .env.example missing${NC}"
    echo "    Create this file to document required environment variables"
    ((WARNINGS++))
fi

if [ -f ".env" ]; then
    echo -e "${YELLOW}  ⚠ .env file found (should be gitignored)${NC}"
    if grep -q "^\.env$" .gitignore; then
        echo -e "${GREEN}    ✓ .env is in .gitignore${NC}"
    else
        echo -e "${RED}    ✗ .env is NOT in .gitignore!${NC}"
        echo "      This is a security risk!"
        ((ERRORS++))
    fi
fi

##############################################################################
# CHECK 4: Secrets in Code
##############################################################################

echo ""
echo -e "${BLUE}[4/10] Checking for hardcoded secrets...${NC}"

SECRETS_FOUND=0

# Check for API keys
if grep -r "sk-proj-" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_* --exclude-dir=docs-dev --exclude="*.example" >/dev/null 2>&1; then
    echo -e "${RED}  ✗ Found OpenAI API keys in code!${NC}"
    ((SECRETS_FOUND++))
fi

if grep -r "sk-ant-" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_* --exclude-dir=docs-dev --exclude="*.example" >/dev/null 2>&1; then
    echo -e "${RED}  ✗ Found Anthropic API keys in code!${NC}"
    ((SECRETS_FOUND++))
fi

if grep -r "eyJ" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backup_* --exclude-dir=docs-dev --exclude="*.example" --exclude="*.md" | grep -v "ANON_KEY" >/dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠ Found JWT-like strings in code${NC}"
    echo "    Verify these are example values, not real credentials"
    ((WARNINGS++))
fi

if [ $SECRETS_FOUND -gt 0 ]; then
    echo -e "${RED}  ✗ CRITICAL: Secrets found in code!${NC}"
    echo "    Replace all hardcoded secrets with environment variables"
    ((ERRORS++))
    ((ERRORS+=$SECRETS_FOUND))
else
    echo -e "${GREEN}  ✓ No obvious secrets found in code${NC}"
fi

##############################################################################
# CHECK 5: Backend Configuration
##############################################################################

echo ""
echo -e "${BLUE}[5/10] Checking backend configuration...${NC}"

if [ -f "backend/package.json" ]; then
    if grep -q '"build"' backend/package.json && grep -q '"start"' backend/package.json; then
        echo -e "${GREEN}  ✓ Backend package.json has build and start scripts${NC}"
    else
        echo -e "${RED}  ✗ Backend package.json missing build or start script${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}  ✗ backend/package.json not found${NC}"
    ((ERRORS++))
fi

if [ -f "backend/railway.json" ]; then
    echo -e "${GREEN}  ✓ backend/railway.json exists${NC}"
else
    echo -e "${YELLOW}  ⚠ backend/railway.json missing${NC}"
    echo "    Railway will use auto-detection, but explicit config is better"
    ((WARNINGS++))
fi

if [ -f "backend/tsconfig.json" ]; then
    echo -e "${GREEN}  ✓ backend/tsconfig.json exists${NC}"
else
    echo -e "${RED}  ✗ backend/tsconfig.json missing${NC}"
    ((ERRORS++))
fi

##############################################################################
# CHECK 6: Frontend Configuration
##############################################################################

echo ""
echo -e "${BLUE}[6/10] Checking frontend configuration...${NC}"

if [ -f "frontend/package.json" ]; then
    if grep -q '"build"' frontend/package.json && grep -q '"start"' frontend/package.json; then
        echo -e "${GREEN}  ✓ Frontend package.json has build and start scripts${NC}"
    else
        echo -e "${RED}  ✗ Frontend package.json missing build or start script${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}  ✗ frontend/package.json not found${NC}"
    ((ERRORS++))
fi

if [ -f "frontend/next.config.ts" ] || [ -f "frontend/next.config.js" ]; then
    echo -e "${GREEN}  ✓ Next.js config exists${NC}"
else
    echo -e "${YELLOW}  ⚠ next.config file missing${NC}"
    echo "    Next.js will use defaults, but explicit config is recommended"
    ((WARNINGS++))
fi

##############################################################################
# CHECK 7: Database Migrations
##############################################################################

echo ""
echo -e "${BLUE}[7/10] Checking database migrations...${NC}"

if [ -d "supabase/migrations" ]; then
    MIGRATION_COUNT=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | xargs)
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        echo -e "${GREEN}  ✓ Found $MIGRATION_COUNT migration files${NC}"
    else
        echo -e "${YELLOW}  ⚠ No migration files found${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠ supabase/migrations directory not found${NC}"
    ((WARNINGS++))
fi

##############################################################################
# CHECK 8: Documentation
##############################################################################

echo ""
echo -e "${BLUE}[8/10] Checking deployment documentation...${NC}"

if [ -f "DEPLOYMENT_PLAN.md" ]; then
    echo -e "${GREEN}  ✓ DEPLOYMENT_PLAN.md exists${NC}"
else
    echo -e "${YELLOW}  ⚠ DEPLOYMENT_PLAN.md missing${NC}"
    ((WARNINGS++))
fi

if [ -f "DEPLOYMENT_QUICK_START.md" ]; then
    echo -e "${GREEN}  ✓ DEPLOYMENT_QUICK_START.md exists${NC}"
else
    echo -e "${YELLOW}  ⚠ DEPLOYMENT_QUICK_START.md missing${NC}"
    ((WARNINGS++))
fi

if [ -f "README.md" ]; then
    echo -e "${GREEN}  ✓ README.md exists${NC}"
else
    echo -e "${YELLOW}  ⚠ README.md missing${NC}"
    ((WARNINGS++))
fi

##############################################################################
# CHECK 9: Dependencies
##############################################################################

echo ""
echo -e "${BLUE}[9/10] Checking dependencies...${NC}"

if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"
else
    echo -e "${YELLOW}  ⚠ Backend dependencies not installed${NC}"
    echo "    Run: cd backend && npm install"
    ((WARNINGS++))
fi

if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}  ⚠ Frontend dependencies not installed${NC}"
    echo "    Run: cd frontend && npm install"
    ((WARNINGS++))
fi

##############################################################################
# CHECK 10: Project Structure
##############################################################################

echo ""
echo -e "${BLUE}[10/10] Checking project structure...${NC}"

REQUIRED_DIRS=("backend/src" "frontend/app" "supabase")
MISSING_DIRS=0

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}  ✓ $dir exists${NC}"
    else
        echo -e "${RED}  ✗ $dir missing${NC}"
        ((MISSING_DIRS++))
        ((ERRORS++))
    fi
done

##############################################################################
# SUMMARY
##############################################################################

echo ""
echo "================================================"
echo "Pre-Deployment Check Complete!"
echo "================================================"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ ERRORS: $ERRORS${NC}"
    echo "   Fix these before deploying"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNINGS: $WARNINGS${NC}"
    echo "   Review these before deploying"
fi

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Your project is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Review DEPLOYMENT_QUICK_START.md"
    echo "  2. Push code to GitHub"
    echo "  3. Deploy to Railway (backend)"
    echo "  4. Deploy to Vercel (frontend)"
    echo ""
fi

if [ $ERRORS -eq 0 ] && [ $WARNINGS -gt 0 ]; then
    echo -e "${GREEN}✅ PROJECT IS DEPLOYABLE${NC}"
    echo ""
    echo "Minor warnings detected (review recommended)"
    echo "You can proceed with deployment if you've addressed the warnings"
    echo ""
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "❌ Cannot deploy until errors are fixed"
    exit 1
fi

exit 0
