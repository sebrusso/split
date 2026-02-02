# Database Operations

Check database status, run queries, or apply migrations.

## Environments

| Environment | Project ID | Purpose |
|-------------|------------|---------|
| **Staging** | `odjvwviokthebfkbqgnx` | Local dev, Expo Go, preview builds |
| **Production** | `rzwuknfycyqitcbotsvx` | TestFlight, App Store |

The Supabase MCP is typically connected to **production**. For staging operations, use direct SQL via `scripts/apply-baseline.js` or Supabase CLI.

---

## Workflow Best Practices

### The Golden Rule

> **Your `supabase/migrations/` folder is the single source of truth.** If a schema change isn't in a migration file, it shouldn't exist in staging or production.

### Proper Migration Workflow

1. **Create migration file**: `npx supabase migration new <name>`
2. **Write SQL** in `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
3. **Test locally**: `npx supabase db reset`
4. **Deploy to staging**: `npx supabase link --project-ref odjvwviokthebfkbqgnx && npx supabase db push`
5. **Run tests**: `npm run test:integration`
6. **Deploy to production**: `npx supabase link --project-ref rzwuknfycyqitcbotsvx && npx supabase db push`

### When to Use MCP vs CLI

| Use MCP For | Use CLI For |
|-------------|-------------|
| Read-only queries on production | Creating new migrations |
| Listing tables/migrations | Deploying to staging |
| Security/performance advisors | Testing migrations locally |
| Production migrations (after staging verification) | Switching between environments |

### What NOT to Do

- Never modify schema via Supabase Dashboard
- Never apply SQL directly without creating a migration file
- Never skip staging verification before production
- Never use MCP tools for staging changes (MCP targets production)

### Staging Parity Verification

After deploying, verify staging matches production:

```sql
-- Check constraints
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';
```

See [docs/DATABASE_WORKFLOW.md](../docs/DATABASE_WORKFLOW.md) for detailed documentation.

---

## Arguments
- `$ARGUMENTS` - Optional: "tables", "migrations", "advisors", or a SQL query

## Commands

### List all tables (default)
Use the Supabase MCP tool: `mcp__supabase__list_tables`

### List migrations
Use: `mcp__supabase__list_migrations`

### Check for security/performance advisors
Use: `mcp__supabase__get_advisors` with type "security" or "performance"

### Execute a query
Use: `mcp__supabase__execute_sql` with the query from $ARGUMENTS

### Apply a migration
Use: `mcp__supabase__apply_migration` with name and query

## Database Schema Reference
```
groups (id, name, emoji, currency, share_code, created_at)
members (id, group_id, name, user_id, created_at)
expenses (id, group_id, description, amount, paid_by, created_at)
splits (id, expense_id, member_id, amount)
```

## Common Queries
```sql
-- Count all groups
SELECT COUNT(*) FROM groups;

-- Get expenses with payer names
SELECT e.*, m.name as payer_name
FROM expenses e
JOIN members m ON e.paid_by = m.id;

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';
```
