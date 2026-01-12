# Supabase Database Index Fixes

This document outlines the plan to resolve performance warnings identified by the Supabase database linter.

## Summary

| Issue Type | Count | Severity |
|------------|-------|----------|
| Unindexed Foreign Keys | 3 | INFO |
| Unused Indexes | 22 | INFO |

---

## Issue 1: Unindexed Foreign Keys

### Problem
Foreign key columns without indexes can cause slow JOIN operations and DELETE cascades. When PostgreSQL needs to check referential integrity, it must scan the entire table without an index.

### Affected Tables

| Table | Foreign Key | Missing Index On |
|-------|-------------|------------------|
| `receipt_member_totals` | `receipt_member_totals_settlement_id_fkey` | `settlement_id` |
| `recurring_expense_splits` | `recurring_expense_splits_member_id_fkey` | `member_id` |
| `recurring_expenses` | `recurring_expenses_paid_by_fkey` | `paid_by` |

### Fix: Add Missing Indexes

```sql
-- Migration: Add indexes for unindexed foreign keys
-- Run this in Supabase SQL Editor

-- 1. Index for receipt_member_totals.settlement_id
CREATE INDEX IF NOT EXISTS idx_receipt_member_totals_settlement_id
ON public.receipt_member_totals (settlement_id);

-- 2. Index for recurring_expense_splits.member_id
CREATE INDEX IF NOT EXISTS idx_recurring_expense_splits_member_id
ON public.recurring_expense_splits (member_id);

-- 3. Index for recurring_expenses.paid_by
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_paid_by
ON public.recurring_expenses (paid_by);
```

---

## Issue 2: Unused Indexes

### Problem
Indexes that are never used still consume storage space and slow down INSERT/UPDATE/DELETE operations because PostgreSQL must maintain them. These should be evaluated and potentially removed.

### Affected Indexes (22 total)

#### Activity & Logging
| Index | Table |
|-------|-------|
| `idx_activity_created` | `activity_log` |
| `idx_reminder_history_reminder` | `reminder_history` |

#### Groups
| Index | Table |
|-------|-------|
| `idx_groups_archived_at` | `groups` |
| `idx_groups_pinned` | `groups` |

#### Members
| Index | Table |
|-------|-------|
| `idx_members_user_id` | `members` |

#### Expenses
| Index | Table |
|-------|-------|
| `idx_expenses_category` | `expenses` |
| `idx_expenses_deleted` | `expenses` |

#### Settlements
| Index | Table |
|-------|-------|
| `idx_settlements_method` | `settlements` |
| `idx_settlements_group_settled` | `settlements` |

#### Receipts
| Index | Table |
|-------|-------|
| `idx_receipts_share_code` | `receipts` |
| `idx_receipts_created_at` | `receipts` |
| `idx_receipts_unassigned` | `receipts` |
| `idx_receipts_clerk_user` | `receipts` |

#### Recurring Expenses
| Index | Table |
|-------|-------|
| `idx_recurring_expenses_next_due_date` | `recurring_expenses` |
| `idx_recurring_expense_splits_recurring_expense_id` | `recurring_expense_splits` |

#### Receipt Member Totals
| Index | Table |
|-------|-------|
| `idx_receipt_member_totals_settled` | `receipt_member_totals` |

#### Item Claims
| Index | Table |
|-------|-------|
| `idx_item_claims_claimed_at` | `item_claims` |

#### Push Tokens
| Index | Table |
|-------|-------|
| `idx_push_tokens_user_id` | `push_tokens` |

#### Payment Reminders
| Index | Table |
|-------|-------|
| `idx_payment_reminders_group` | `payment_reminders` |
| `idx_payment_reminders_status` | `payment_reminders` |
| `idx_payment_reminders_scheduled` | `payment_reminders` |
| `idx_payment_reminders_created_by` | `payment_reminders` |

### Recommendation

Before dropping unused indexes, consider:

1. **App maturity**: If the app is new, some indexes may be for features not yet used in production
2. **Future queries**: Some indexes may be needed for planned features
3. **Batch operations**: Some indexes may only be used during periodic jobs

### Indexes Safe to Remove (Low Risk)

These indexes appear to be for features that may not be actively used:

```sql
-- Migration: Remove definitely unused indexes
-- CAUTION: Review each before running in production

-- Activity logging indexes (if activity log is write-only)
DROP INDEX IF EXISTS idx_activity_created;
DROP INDEX IF EXISTS idx_reminder_history_reminder;

-- If soft-delete isn't queried by deleted status
DROP INDEX IF EXISTS idx_expenses_deleted;
```

### Indexes to Keep Under Review

These may be needed as the app scales or features are used more:

```sql
-- DO NOT RUN YET - Keep these under review

-- May be needed for user-specific queries
-- DROP INDEX IF EXISTS idx_members_user_id;
-- DROP INDEX IF EXISTS idx_push_tokens_user_id;
-- DROP INDEX IF EXISTS idx_receipts_clerk_user;

-- May be needed for filtering/sorting
-- DROP INDEX IF EXISTS idx_groups_archived_at;
-- DROP INDEX IF EXISTS idx_groups_pinned;
-- DROP INDEX IF EXISTS idx_expenses_category;
-- DROP INDEX IF EXISTS idx_receipts_created_at;

-- May be needed for share code lookups
-- DROP INDEX IF EXISTS idx_receipts_share_code;

-- May be needed for recurring expense scheduler
-- DROP INDEX IF EXISTS idx_recurring_expenses_next_due_date;
-- DROP INDEX IF EXISTS idx_recurring_expense_splits_recurring_expense_id;

-- May be needed for settlement queries
-- DROP INDEX IF EXISTS idx_settlements_method;
-- DROP INDEX IF EXISTS idx_settlements_group_settled;

-- Receipt-related
-- DROP INDEX IF EXISTS idx_receipt_member_totals_settled;
-- DROP INDEX IF EXISTS idx_receipts_unassigned;
-- DROP INDEX IF EXISTS idx_item_claims_claimed_at;

-- Payment reminder indexes
-- DROP INDEX IF EXISTS idx_payment_reminders_group;
-- DROP INDEX IF EXISTS idx_payment_reminders_status;
-- DROP INDEX IF EXISTS idx_payment_reminders_scheduled;
-- DROP INDEX IF EXISTS idx_payment_reminders_created_by;
```

---

## Complete Migration Script

### Step 1: Add Missing Foreign Key Indexes (Required)

Run this first - these are safe and beneficial:

```sql
-- =============================================
-- MIGRATION: Add Foreign Key Indexes
-- Date: 2026-01-12
-- Description: Add missing indexes for foreign keys
-- =============================================

BEGIN;

-- Add index for receipt_member_totals.settlement_id
CREATE INDEX IF NOT EXISTS idx_receipt_member_totals_settlement_id
ON public.receipt_member_totals (settlement_id);

-- Add index for recurring_expense_splits.member_id
CREATE INDEX IF NOT EXISTS idx_recurring_expense_splits_member_id
ON public.recurring_expense_splits (member_id);

-- Add index for recurring_expenses.paid_by
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_paid_by
ON public.recurring_expenses (paid_by);

COMMIT;
```

### Step 2: Remove Unused Indexes (Optional - Use Caution)

Only run after reviewing which features are actually in use:

```sql
-- =============================================
-- MIGRATION: Remove Unused Indexes (OPTIONAL)
-- Date: 2026-01-12
-- Description: Remove indexes that have never been used
-- CAUTION: Review app usage before running
-- =============================================

BEGIN;

-- Batch 1: Low-risk removals (logging/audit tables)
DROP INDEX IF EXISTS idx_activity_created;
DROP INDEX IF EXISTS idx_reminder_history_reminder;

-- Batch 2: Feature-dependent (uncomment if feature not used)
-- DROP INDEX IF EXISTS idx_expenses_deleted;
-- DROP INDEX IF EXISTS idx_groups_archived_at;
-- DROP INDEX IF EXISTS idx_groups_pinned;

COMMIT;
```

---

## How to Apply

### Option A: Supabase Dashboard (Recommended for small changes)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Paste the migration script
4. Click **Run**

### Option B: Supabase CLI

```bash
# Create a new migration
supabase migration new add_foreign_key_indexes

# Edit the migration file in supabase/migrations/
# Paste the SQL content

# Apply locally
supabase db reset

# Push to production
supabase db push
```

---

## Verification

After applying the migration, verify the changes:

```sql
-- Check that new indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
    'idx_receipt_member_totals_settlement_id',
    'idx_recurring_expense_splits_member_id',
    'idx_recurring_expenses_paid_by'
);

-- Re-run the database linter in Supabase Dashboard
-- Dashboard > Database > Linter
```

---

## Timeline

| Phase | Action | Risk |
|-------|--------|------|
| **Now** | Add 3 missing FK indexes | None - purely beneficial |
| **Week 2** | Monitor index usage stats | None |
| **Week 4** | Review & remove confirmed unused indexes | Low - reversible |

---

## References

- [Supabase Database Linter Docs](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Unindexed Foreign Keys Lint](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Unused Index Lint](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
