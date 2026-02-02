---
name: supabase-workflow
description: |
  Enforce proper Supabase database workflow for schema changes in the split it. project.
  Use when: (1) user asks to modify database schema, (2) adding constraints, indexes, or triggers,
  (3) creating or modifying tables, (4) user asks about staging vs production databases,
  (5) any database migration task. Ensures migrations are the source of truth and staging
  is tested before production.
author: Claude Code
version: 1.0.0
date: 2026-02-01
---

# Supabase Database Workflow

## The Golden Rule

> **Your `supabase/migrations/` folder is the single source of truth.** If a schema change isn't in a migration file, it shouldn't exist in staging or production.

## Context / Trigger Conditions

- User asks to add, modify, or delete database tables
- User asks to add constraints, indexes, triggers, or functions
- User wants to modify RLS policies
- User asks about staging vs production database
- User mentions database migrations
- Any task involving schema changes

## Environment Context

| Environment | Project Ref | MCP Connection |
|-------------|-------------|----------------|
| **Staging** | `odjvwviokthebfkbqgnx` | Not connected (use CLI) |
| **Production** | `rzwuknfycyqitcbotsvx` | **Default MCP target** |

**Important**: Supabase MCP tools connect to production by default. For staging operations, use:
- Supabase CLI with `--project-ref odjvwviokthebfkbqgnx`
- Direct PostgreSQL connections
- Scripts like `scripts/apply-baseline.js`

## Required Workflow

### For Any Schema Change

1. **Create migration file first**
   ```bash
   npx supabase migration new <descriptive_name>
   ```

2. **Write SQL in the migration file**
   - File location: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
   - Include constraints, indexes, RLS policies

3. **Test locally**
   ```bash
   npx supabase db reset
   ```

4. **Deploy to staging**
   ```bash
   npx supabase link --project-ref odjvwviokthebfkbqgnx
   npx supabase db push
   ```

5. **Run tests**
   ```bash
   npm run test:integration
   ```

6. **Deploy to production**
   ```bash
   npx supabase link --project-ref rzwuknfycyqitcbotsvx
   npx supabase db push
   ```

## MCP Tool Usage

### When to Use MCP Tools

- **Read-only queries**: `mcp__supabase__execute_sql` for SELECT queries
- **Schema inspection**: `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`
- **Advisors**: `mcp__supabase__get_advisors` for security/performance checks
- **Production migrations**: `mcp__supabase__apply_migration` (creates migration AND applies)

### When NOT to Use MCP Tools

- Staging database changes (MCP connects to production)
- Testing migrations (use local Supabase)
- Exploratory schema changes (create migration file first)

### MCP Migration Pattern

When using `mcp__supabase__apply_migration`:
1. This applies to **production** only
2. First verify the migration works on staging via CLI
3. Use descriptive snake_case names

```javascript
// Example MCP migration
mcp__supabase__apply_migration({
  name: "add_user_preferences",
  query: `
    CREATE TABLE user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      theme TEXT DEFAULT 'light'
    );
  `
})
```

## What NOT to Do

| Action | Problem | Correct Approach |
|--------|---------|------------------|
| Edit schema in Supabase Dashboard | Creates drift from migrations | Create migration file first |
| Apply SQL without migration file | Won't be reproducible | Write SQL in migration file |
| Use MCP for staging changes | MCP targets production | Use CLI with staging ref |
| Skip staging verification | May break production | Test on staging first |
| Modify existing migration files | Causes version conflicts | Create new migration |

## Verification Steps

After any schema change, verify:

1. **Migration file exists** in `supabase/migrations/`
2. **Local test passes**: `npx supabase db reset`
3. **Staging has the changes**: Link to staging and check
4. **Tests pass**: `npm run test:integration`
5. **Production matches staging** after deployment

## Schema Comparison (for debugging)

Check constraints:
```sql
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public';
```

Check indexes:
```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';
```

## Related Skills

- `supabase-branch-parity`: For fixing staging/production drift issues

## References

- [docs/DATABASE_WORKFLOW.md](../../docs/DATABASE_WORKFLOW.md) - Full workflow documentation
- [docs/DATABASE_ENVIRONMENT_SETUP.md](../../docs/DATABASE_ENVIRONMENT_SETUP.md) - Environment setup
