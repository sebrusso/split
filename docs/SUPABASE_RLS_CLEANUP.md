# Supabase RLS Policy Cleanup Plan

## Problem Summary

The Supabase database linter has detected **14 warnings** for `multiple_permissive_policies`. This occurs when a table has more than one permissive RLS policy for the same role and action combination.

### Why This Matters

- **Performance Impact**: PostgreSQL must evaluate ALL permissive policies for every query, even if one policy would already grant access
- **Maintenance Overhead**: Duplicate policies create confusion about which rules actually apply
- **Debugging Difficulty**: Harder to reason about access control when multiple overlapping policies exist

### Affected Tables

| Table | Actions with Duplicate Policies |
|-------|--------------------------------|
| `expenses` | SELECT, INSERT, DELETE |
| `groups` | SELECT, INSERT, UPDATE |
| `members` | SELECT, INSERT |
| `settlements` | SELECT, INSERT, UPDATE |
| `splits` | SELECT, INSERT, DELETE |

---

## Root Cause

It appears that two sets of policies were created:
1. **Generic "public access" policies** (e.g., "Allow public read access to expenses")
2. **More specific "group member" policies** (e.g., "Group members can read expenses")

Both sets grant the same access to the `authenticated` role, creating redundancy.

---

## Solution

Consolidate duplicate policies by:
1. Dropping the generic "public access" policies
2. Keeping the more descriptive "group member" policies (or vice versa, depending on which has better logic)

For this MVP with public read/write access, we'll keep the simpler "public access" policies and remove the redundant "group member" ones to maintain simplicity.

---

## Migration Query

Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor > New query):

```sql
-- ============================================
-- RLS Policy Cleanup Migration
-- Purpose: Remove duplicate permissive policies
-- Date: 2026-01-12
-- ============================================

-- Start transaction for safety
BEGIN;

-- ============================================
-- EXPENSES TABLE
-- Keep: "Allow public *" policies
-- Remove: "Group members can *" policies
-- ============================================

DROP POLICY IF EXISTS "Group members can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Group members can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Group members can read expenses" ON public.expenses;

-- ============================================
-- GROUPS TABLE
-- Keep: "Allow public *" policies
-- Remove: "* can * groups" policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can create groups" ON public.groups;
DROP POLICY IF EXISTS "Members can read their groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;

-- ============================================
-- MEMBERS TABLE
-- Keep: "Allow public *" policies
-- Remove: "Group members can *" policies
-- ============================================

DROP POLICY IF EXISTS "Group members can add members" ON public.members;
DROP POLICY IF EXISTS "Group members can read members" ON public.members;

-- ============================================
-- SETTLEMENTS TABLE
-- Keep: "Public access" policy
-- Remove: "Group members can *" policies
-- ============================================

DROP POLICY IF EXISTS "Group members can create settlements" ON public.settlements;
DROP POLICY IF EXISTS "Group members can read settlements" ON public.settlements;
DROP POLICY IF EXISTS "Group members can update settlements" ON public.settlements;

-- ============================================
-- SPLITS TABLE
-- Keep: "Allow public *" policies
-- Remove: "Group members can *" policies
-- ============================================

DROP POLICY IF EXISTS "Group members can delete splits" ON public.splits;
DROP POLICY IF EXISTS "Group members can create splits" ON public.splits;
DROP POLICY IF EXISTS "Group members can read splits" ON public.splits;

COMMIT;
```

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste the migration SQL above
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Verify the output shows successful drops

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI configured
supabase db push
```

### Option 3: Direct psql Connection

```bash
psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres" \
  -f migration.sql
```

---

## Verification

After running the migration, verify the cleanup was successful:

```sql
-- Check remaining policies on each table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('expenses', 'groups', 'members', 'settlements', 'splits')
ORDER BY tablename, cmd;
```

### Expected Result

Each table should have only ONE policy per action (SELECT, INSERT, UPDATE, DELETE):

| Table | Expected Remaining Policies |
|-------|----------------------------|
| `expenses` | Allow public read/insert/delete access |
| `groups` | Allow public read/insert/update access |
| `members` | Allow public read/insert access |
| `settlements` | Public access (all actions) |
| `splits` | Allow public read/insert/delete access |

---

## Re-run Linter

After applying the migration:

1. Go to Supabase Dashboard
2. Navigate to **Database** > **Linter** (or **Advisors**)
3. Click **Refresh** or re-run the lint checks
4. Verify the `multiple_permissive_policies` warnings are resolved

---

## Rollback (If Needed)

If you need to restore the removed policies, you'll need to recreate them. Here's the rollback SQL:

```sql
-- ROLLBACK: Recreate removed policies
-- Only run this if you need to undo the cleanup

-- Expenses
CREATE POLICY "Group members can read expenses" ON public.expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Group members can create expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group members can delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (true);

-- Groups
CREATE POLICY "Anyone can create groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can read their groups" ON public.groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can update their groups" ON public.groups
  FOR UPDATE TO authenticated USING (true);

-- Members
CREATE POLICY "Group members can add members" ON public.members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group members can read members" ON public.members
  FOR SELECT TO authenticated USING (true);

-- Settlements
CREATE POLICY "Group members can create settlements" ON public.settlements
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group members can read settlements" ON public.settlements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Group members can update settlements" ON public.settlements
  FOR UPDATE TO authenticated USING (true);

-- Splits
CREATE POLICY "Group members can create splits" ON public.splits
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group members can read splits" ON public.splits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Group members can delete splits" ON public.splits
  FOR DELETE TO authenticated USING (true);
```

---

## Future Considerations

When adding new RLS policies:

1. **Check existing policies first**: Run `SELECT * FROM pg_policies WHERE tablename = 'your_table'`
2. **One policy per role/action**: Avoid creating multiple permissive policies for the same combination
3. **Use OR conditions**: If you need complex logic, combine conditions within a single policy using `OR`
4. **Consider restrictive policies**: For layered security, use `RESTRICTIVE` policies that must ALL pass

### Example: Single Policy with Multiple Conditions

```sql
-- Instead of two separate policies:
-- Policy 1: "Public can read"
-- Policy 2: "Members can read their groups"

-- Use one policy with combined logic:
CREATE POLICY "read_access" ON public.groups
  FOR SELECT TO authenticated
  USING (
    true  -- Public access (MVP)
    -- OR auth.uid() IN (SELECT user_id FROM members WHERE group_id = id)
  );
```

---

## Related Documentation

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Linter: Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
