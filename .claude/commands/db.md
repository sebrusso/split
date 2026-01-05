# Database Operations

Check database status, run queries, or apply migrations.

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
