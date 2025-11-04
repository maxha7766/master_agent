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
