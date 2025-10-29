#!/bin/bash
cd /Users/heathmaxwell/master_agent

# Get token from .env
TOKEN=$(grep GITHUB_PERSONAL_ACCESS_TOKEN backend/.env | cut -d '=' -f 2)

# Create repository
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "master_agent",
    "description": "Personal AI Assistant with RAG, hybrid search, and conversational interface. Built with Next.js, Express, Supabase, and Claude.",
    "private": false
  }'

echo ""
echo "Repository created! Now pushing code..."

# Add remote and push
git remote add origin https://github.com/heathmaxwell/master_agent.git 2>/dev/null || git remote set-url origin https://github.com/heathmaxwell/master_agent.git
git add .
git commit -m "Initial commit: Personal AI Assistant with hybrid RAG search

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git branch -M main
git push -u origin main

echo "✅ Done! Repository: https://github.com/heathmaxwell/master_agent"
