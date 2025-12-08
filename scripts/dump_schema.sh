#!/bin/bash
set -e

# Load .env variables
# We use a safer way to source .env avoiding issues with comments or special chars
set -a
source backend/.env
set +a

echo "🚀 Linking Supabase project..."
# Link project using credentials from .env
# We use 'yes' to accept any potential prompts (though flags should cover it)
supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_PROJECT_PASSWORD"

echo "💾 Dumping remote schema..."
supabase db dump --linked > backend/src/database/migrations/000_baseline.sql

echo "✅ Schema dumped successfully to backend/src/database/migrations/000_baseline.sql"
