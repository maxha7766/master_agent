# Hybrid Search Setup Instructions

## Step 1: Run SQL in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/omjwoyyhpdawjxsbpamc
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the entire contents of `setup-hybrid-search.sql` and paste into the editor
5. Click "Run" or press `Ctrl/Cmd + Enter`

You should see:
```
Success. No rows returned
```

## Step 2: Verify Functions Were Created

Run this query in the SQL Editor:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('match_documents', 'search_documents_fulltext')
ORDER BY routine_name;
```

You should see 2 rows:
- `match_documents` | `FUNCTION`
- `search_documents_fulltext` | `FUNCTION`

## Step 3: Test Hybrid Search

Run the test script:
```bash
cd /Users/heathmaxwell/master_agent/backend
node test-hybrid-search.mjs
```

Expected output:
```
=== Testing Hybrid Search Implementation ===

📁 Checking documents...
✅ Found 1 documents:
   - rules of baseball.pdf (186 chunks)

🔢 Generating query embedding...
✅ Generated embedding (1536 dimensions)

🔍 Testing vector search (match_documents)...
✅ Vector search successful: 5 results
   Top result similarity: 0.8234
   Content: A balk occurs when a pitcher makes an illegal motion...

📝 Testing fulltext search (search_documents_fulltext)...
✅ Fulltext search successful: 3 results
   Top result rank: 0.2456
   Content: The rules regarding balks are designed to prevent...

🔀 Testing RRF combination...
✅ RRF combination complete: 5 results

📊 Top 3 hybrid results:
1. Score: 0.0234 (V: 0.0162, T: 0.0072)
   A balk occurs when a pitcher makes an illegal motion on the mound...

✅ All tests complete!
```

## Step 4: Test in the App

1. Go to http://localhost:3000
2. In the chat, ask: **"give me the summary of the rules of a balk"**
3. You should get a detailed, conversational response with citations

## What Was Implemented

### ✅ Complete Hybrid Search Pipeline
1. **Vector Search** - Cosine similarity using pgvector
2. **Full-Text Search** - PostgreSQL `ts_rank_cd` with `websearch_to_tsquery`
3. **RRF Fusion** - Reciprocal Rank Fusion (k=60) in TypeScript
4. **Cohere Reranking** - Optional semantic reranking using `rerank-english-v3.0`

### ✅ Conversational RAG Agent
- Warm, friendly tone inspired by master-rag
- Asks clarifying questions
- Offers to explore related topics
- Cites sources inline using [Source 1], [Source 2] notation

### ✅ Environment
- Cohere API key added to `.env`
- Backend auto-reloads with new code
- Reranking enabled by default if API key is present

## Troubleshooting

### If hybrid search functions don't exist:
```sql
-- Check what functions DO exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### If you get "function does not exist" error:
Make sure you ran the full `setup-hybrid-search.sql` script.

### If reranking is not working:
Check logs for:
```
"message":"Cohere reranking service initialized"
```

If you see:
```
"message":"Cohere API key not found, reranking disabled"
```

Then check your `.env` file has:
```
COHERE_API_KEY=LHUUqcTJTV2aFfXHh1TjNeO2jSl5H2qHh2pW4H6q
```
