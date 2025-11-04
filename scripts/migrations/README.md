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
