# Database Constraints Migration Plan

## Overview

This document outlines data integrity constraints in the Supabase database.
These constraints prevent invalid data from being inserted, catching bugs at the database level.

**Status**: ✅ COMPLETE (January 23, 2026)
**Last Verified**: February 1, 2026
**Risk Level**: Low (all data cleaned, constraints active)

---

## Current State (Audit: January 23, 2026)

### Issues Found & Fixed ✅
- **4 expenses** had splits exceeding expense totals - **FIXED**
  - Teddy's Restaurant & Bar: $26.67 overage → expense updated to $275.68
  - water: $0.01 overage → expense updated to $20.01
  - Uber: $0.01 overage → expense updated to $2,000,000.01
  - Pub dinner: $0.01 overage → expense updated to $65.01

### Clean Areas (No Issues)
- No sub-cent amounts
- No duplicate splits
- No empty names
- No excessively long names

---

## Active Constraints

### Phase 1: Safe Constraints ✅ ALREADY EXISTED

```sql
-- 1. Minimum expense amount (at least 1 cent)
ALTER TABLE expenses
ADD CONSTRAINT expenses_amount_min
CHECK (amount >= 0.01);

-- 2. Maximum name lengths
ALTER TABLE groups
ADD CONSTRAINT groups_name_max_length
CHECK (char_length(name) <= 255);

ALTER TABLE members
ADD CONSTRAINT members_name_max_length
CHECK (char_length(name) <= 255);

-- 3. Non-empty names
ALTER TABLE groups
ADD CONSTRAINT groups_name_not_empty
CHECK (TRIM(name) != '');

ALTER TABLE members
ADD CONSTRAINT members_name_not_empty
CHECK (TRIM(name) != '');

-- 4. Prevent duplicate splits (same member on same expense)
ALTER TABLE splits
ADD CONSTRAINT splits_unique_member_expense
UNIQUE (expense_id, member_id);
```

### Phase 2: Split Validation Trigger ✅ APPLIED

```sql
-- Split total validation (requires trigger, not simple CHECK)
-- This needs a trigger function because it involves multiple rows

CREATE OR REPLACE FUNCTION check_splits_not_exceed_expense()
RETURNS TRIGGER AS $$
DECLARE
    expense_amount NUMERIC;
    total_splits NUMERIC;
BEGIN
    -- Get the expense amount
    SELECT amount INTO expense_amount
    FROM expenses WHERE id = NEW.expense_id;

    -- Calculate total splits including the new one
    SELECT COALESCE(SUM(amount), 0) + NEW.amount INTO total_splits
    FROM splits
    WHERE expense_id = NEW.expense_id AND id != COALESCE(NEW.id, '');

    -- Allow small rounding tolerance (1 cent)
    IF total_splits > expense_amount + 0.01 THEN
        RAISE EXCEPTION 'Split total (%) exceeds expense amount (%)',
            total_splits, expense_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_splits_not_exceed_expense
BEFORE INSERT OR UPDATE ON splits
FOR EACH ROW EXECUTE FUNCTION check_splits_not_exceed_expense();
```

---

## Data Cleanup Required

Before adding Phase 2 constraints, fix these expenses:

### Option A: Adjust expense amounts to match splits
```sql
-- Update expense amounts to match actual split totals
UPDATE expenses e
SET amount = (SELECT SUM(amount) FROM splits WHERE expense_id = e.id)
WHERE id IN (
    '25065388-13a5-40b3-9d4e-223a7113d5b6',  -- Teddy's
    '2b8ad7e3-a44e-4f12-80ef-da8fa3bbab8f',  -- water
    '7803eea8-e981-4474-a0f1-96dc517d4d11',  -- Uber
    'e939e31a-ffd5-4801-8370-8b5c35ec21dd'   -- Pub dinner
);
```

### Option B: Adjust splits to match expense amounts
```sql
-- This requires manual review to decide which splits to reduce
-- Not recommended for automated fix
```

### Option C: Add tolerance to constraint
Allow 1-2% tolerance for rounding errors instead of strict equality.

---

## Implementation Steps (COMPLETED)

### Step 1: Phase 1 constraints ✅
- [x] Already existed in database
- [x] Verified all constraints active

### Step 2: Data cleanup ✅
- [x] Identified 4 affected expenses
- [x] Updated expense amounts to match split totals
- [x] Verified no remaining discrepancies

### Step 3: Phase 2 trigger ✅
- [x] Created `check_splits_not_exceed_expense()` function
- [x] Applied trigger on splits table
- [x] Allows 1-cent tolerance for rounding

---

## Rollback Plan

If constraints cause issues:

```sql
-- Remove Phase 1 constraints
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_min;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_max_length;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_not_empty;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_name_max_length;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_name_not_empty;
ALTER TABLE splits DROP CONSTRAINT IF EXISTS splits_unique_member_expense;

-- Remove Phase 2 trigger
DROP TRIGGER IF EXISTS enforce_splits_not_exceed_expense ON splits;
DROP FUNCTION IF EXISTS check_splits_not_exceed_expense();
```

---

## Summary

All database integrity constraints are now active:

| Constraint | Table | Status |
|------------|-------|--------|
| `expenses_amount_check` | expenses | ✅ Active (amount > 0) |
| `expenses_description_max_length` | expenses | ✅ Active |
| `expenses_description_not_empty` | expenses | ✅ Active |
| `groups_name_max_length` | groups | ✅ Active (≤255 chars) |
| `groups_name_not_empty` | groups | ✅ Active |
| `members_name_max_length` | members | ✅ Active (≤255 chars) |
| `members_name_not_empty` | members | ✅ Active |
| `splits_unique_member_expense` | splits | ✅ Active |
| `enforce_splits_not_exceed_expense` | splits | ✅ Active (trigger, 1¢ tolerance) |

The database now prevents:
- Empty or overly long names
- Zero/negative expense amounts
- Duplicate splits for same member on same expense
- Splits exceeding expense total (with 1¢ rounding tolerance)
