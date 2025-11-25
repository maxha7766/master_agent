# Apply Memory System Migration

Since we're using Supabase, you need to run the migration SQL through the Supabase dashboard:

1. Go to https://supabase.com/dashboard/project/omjwoyyhpdawjxsbpamc
2. Navigate to "SQL Editor" in the left sidebar
3. Create a new query
4. Copy the contents of `migrations/005_create_memory_tables.sql`
5. Paste into the SQL editor
6. Click "Run" button

Alternatively, if you have `psql` installed locally:
```bash
psql "postgresql://postgres.omjwoyyhpdawjxsbpamc:Savannah.3122@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f migrations/005_create_memory_tables.sql
```

Or use the Supabase CLI:
```bash
supabase db push
```

The migration will create these tables:
- `user_memories` - Semantic memory storage with embeddings
- `entities` - Entity tracking (people, places, organizations, etc.)
- `entity_relationships` - Relationship graph between entities
- `conversation_summaries` - Condensed conversation history

All tables include:
- Row Level Security (RLS) policies
- Vector indexes for semantic search
- Proper foreign keys and constraints
- Updated_at triggers
