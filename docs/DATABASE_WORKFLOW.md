# Database Workflow Guide

This guide documents the proper workflow for making database changes in the split it. project using Supabase.

---

## The Golden Rule

> **Your `supabase/migrations/` folder is the single source of truth.** If a schema change isn't in a migration file, it shouldn't exist in staging or production.

This means:
- Never use the Supabase Dashboard to modify schema directly
- Never apply SQL to staging/production without creating a migration file first
- Always test migrations locally before deploying

---

## Environment Overview

| Environment | Project Ref | URL | Purpose |
|-------------|-------------|-----|---------|
| **Staging** | `odjvwviokthebfkbqgnx` | `odjvwviokthebfkbqgnx.supabase.co` | Development, testing, Expo Go |
| **Production** | `rzwuknfycyqitcbotsvx` | `rzwuknfycyqitcbotsvx.supabase.co` | TestFlight, App Store |

### MCP Tool Context

The Supabase MCP tools connect to **production** by default. For staging operations:
- Use Supabase CLI with `--project-ref odjvwviokthebfkbqgnx`
- Use direct PostgreSQL connections
- Use scripts like `scripts/apply-baseline.js`

---

## Step-by-Step Workflow for Schema Changes

### Step 1: Create Migration Locally

```bash
# Create a new migration file
npx supabase migration new <descriptive_name>

# Example:
npx supabase migration new add_user_preferences
```

This creates a file like:
```
supabase/migrations/20260201000000_add_user_preferences.sql
```

### Step 2: Write Your SQL

Edit the migration file with your schema changes:

```sql
-- supabase/migrations/20260201000000_add_user_preferences.sql

-- Create table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  theme TEXT DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraints
ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_theme_valid
  CHECK (theme IN ('light', 'dark', 'system'));

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  FOR ALL
  USING (auth.jwt() ->> 'sub' = user_id);
```

### Step 3: Test Locally

```bash
# Reset local database and apply all migrations
npx supabase db reset

# Or if using local Supabase:
npx supabase start
npx supabase db reset
```

### Step 4: Commit and Push

```bash
git add supabase/migrations/
git commit -m "Add user preferences table"
git push origin feature/user-preferences
```

### Step 5: Deploy to Staging

```bash
# Link to staging project
npx supabase link --project-ref odjvwviokthebfkbqgnx

# Push migrations
npx supabase db push
```

### Step 6: Verify and Test

```bash
# Run integration tests against staging
npm run test:integration

# Manually verify in Expo Go app
npm start
```

### Step 7: Deploy to Production

After staging verification:

```bash
# Link to production project
npx supabase link --project-ref rzwuknfycyqitcbotsvx

# Push migrations
npx supabase db push
```

Or merge to `main` branch if GitHub integration is configured.

---

## Common Pitfalls and Solutions

### Pitfall 1: Modifying Schema via Dashboard

**Problem**: Making changes directly in Supabase Dashboard creates drift between your migration files and actual database state.

**Solution**: Always create a migration file first, even for "quick" changes. If you already made dashboard changes:
1. Document what you changed
2. Create a migration file with those changes
3. Reset staging and production from migrations

### Pitfall 2: Staging/Production Parity Issues

**Problem**: Staging branch has different schema objects than production after reset/rebase.

**Symptoms**:
- Tests pass on production but fail on staging
- Missing constraints, indexes, or triggers
- "Column already exists" errors during migration push

**Solution**: See the `supabase-branch-parity` skill for detailed remediation steps. Key approach:
1. Compare schema objects between environments
2. Clean up violating data
3. Apply missing objects directly via SQL
4. Create migration file for future deployments

### Pitfall 3: Constraint Violations on Migration

**Problem**: Adding CHECK constraints fails because existing data violates them.

**Solution**: Clean data before adding constraints:

```sql
-- Find violating rows
SELECT id, name FROM groups WHERE regexp_replace(name, '\s', '', 'g') = '';

-- Fix or delete them
DELETE FROM groups WHERE regexp_replace(name, '\s', '', 'g') = '';

-- Then add constraint
ALTER TABLE groups ADD CONSTRAINT groups_name_not_empty
  CHECK (regexp_replace(name, '\s', '', 'g') <> '');
```

### Pitfall 4: Skipping Staging Verification

**Problem**: Pushing directly to production without testing on staging.

**Solution**: Always follow the full workflow:
1. Local testing with `npx supabase db reset`
2. Deploy to staging
3. Run integration tests
4. Manual verification
5. Only then deploy to production

---

## What NOT to Do

| Action | Why It's Bad | What To Do Instead |
|--------|--------------|-------------------|
| Edit schema in Supabase Dashboard | Creates drift from migrations | Create migration file first |
| Apply SQL directly without migration | Won't be reproducible | Write SQL in migration file |
| Skip staging verification | Breaks production | Test on staging first |
| Use MCP tools for staging changes | MCP connects to production | Use CLI or direct SQL |
| Commit migration without testing | May fail on deployment | Run `npx supabase db reset` first |

---

## Schema Comparison Queries

Use these queries to compare environments when debugging parity issues:

### Check Constraints

```sql
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

### Unique Indexes

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY tablename;
```

### Triggers

```sql
SELECT tgname, relname as table_name, proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relnamespace = 'public'::regnamespace
  AND NOT tgisinternal
ORDER BY relname;
```

### RLS Policies

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## CI/CD Integration

### Recommended GitHub Actions Workflow

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Deploy to Production
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Pre-merge Validation

Before merging PRs with migrations:
1. Run `npx supabase db reset` locally
2. Verify migration applies cleanly
3. Check that integration tests pass

---

## Troubleshooting

### "Migration already applied" Error

The migration version exists in `supabase_migrations.schema_migrations` but the file is different.

**Solution**: Create a new migration with the changes instead of modifying an existing one.

### "Constraint violated by some row" Error

Existing data doesn't satisfy the new constraint.

**Solution**:
1. Query for violating rows
2. Fix or delete them
3. Retry the migration

### Branch Shows MIGRATIONS_FAILED Status

The staging branch couldn't apply migrations after reset/rebase.

**Solution**: See the `supabase-branch-parity` skill for detailed remediation.

### Column Type Mismatch

Staging has `NUMERIC` but production has `NUMERIC(10,2)`.

**Solution**:
```sql
ALTER TABLE expenses ALTER COLUMN amount TYPE NUMERIC(10,2);
```

---

## Quick Reference

```bash
# Create new migration
npx supabase migration new <name>

# Test locally
npx supabase db reset

# Deploy to staging
npx supabase link --project-ref odjvwviokthebfkbqgnx
npx supabase db push

# Deploy to production
npx supabase link --project-ref rzwuknfycyqitcbotsvx
npx supabase db push

# Check migration history
npx supabase migration list
```

---

## Related Documentation

- [DATABASE_ENVIRONMENT_SETUP.md](./DATABASE_ENVIRONMENT_SETUP.md) - Environment configuration
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/managing-environments)
- [Supabase Branching](https://supabase.com/docs/guides/platform/branching)
