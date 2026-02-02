# Database Audit & Remediation Plan

**Audit Date:** 2026-02-01
**Auditor:** Tech Lead Agent
**Scope:** 31 migrations, 18 tables, ~50 RLS policies

---

## Executive Summary

The split it. database is well-structured for an expense-splitting application with proper foreign key relationships and recent security improvements. However, **3 critical RLS vulnerabilities** require immediate attention, along with 5 high-priority issues that could impact data integrity.

---

## 1. Critical Issues (Fix Immediately)

### C1: Groups Table - Overly Permissive SELECT Policy

**Location:** `20260117000001_remove_permissive_rls_bypass.sql` line 43-46

**Current Policy:**
```sql
CREATE POLICY "Users can read groups they created"
ON public.groups FOR SELECT
TO authenticated
USING (true);  -- VULNERABLE: Allows reading ANY group
```

**Impact:** Any authenticated user can read ALL groups, exposing group names, share codes, and metadata to unauthorized users.

**Fix:**
```sql
DROP POLICY IF EXISTS "Users can read groups they created" ON public.groups;

CREATE POLICY "Members can read their groups"
ON public.groups FOR SELECT
TO authenticated
USING (
  is_group_member(id)
  OR share_code IS NOT NULL  -- Allow reading for join flow
);
```

---

### C2: Payment Events - Anonymous Read/Write Access

**Location:** `20260112000006_payment_events.sql` lines 46-49

**Current Policy:**
```sql
CREATE POLICY "Allow anon read access to payment_events"
  ON payment_events FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert access to payment_events"
  ON payment_events FOR INSERT TO anon WITH CHECK (true);
```

**Impact:** Anonymous users can read payment history and insert fake payment events, enabling analytics poisoning and potential privacy leakage.

**Fix:**
```sql
DROP POLICY IF EXISTS "Allow anon read access to payment_events" ON payment_events;
DROP POLICY IF EXISTS "Allow anon insert access to payment_events" ON payment_events;

-- Only authenticated users who are group members can access payment events
CREATE POLICY "Members can read payment events"
ON payment_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = payment_events.from_member_id
    AND m.clerk_user_id = get_clerk_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = payment_events.to_member_id
    AND m.clerk_user_id = get_clerk_user_id()
  )
);

CREATE POLICY "Members can insert payment events"
ON payment_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = from_member_id
    AND m.clerk_user_id = get_clerk_user_id()
  )
);
```

---

### C3: Members Table - Anonymous Can Read All Members

**Location:** `20260113000002_secure_rls_policies.sql` lines 95-98

**Current Policy:**
```sql
CREATE POLICY "Anyone can read members for joining"
ON public.members FOR SELECT
TO anon
USING (true);
```

**Impact:** Anonymous users can enumerate all members across all groups, exposing PII (names, clerk_user_ids).

**Fix:**
```sql
DROP POLICY IF EXISTS "Anyone can read members for joining" ON public.members;

CREATE POLICY "Anyone can read members for joining via share code"
ON public.members FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_id
    AND g.share_code IS NOT NULL
  )
);
```

---

## 2. High Priority Issues (Fix Within 1 Week)

### H1: Missing Unique Constraint on splits

**Issue:** No unique constraint prevents duplicate splits for the same expense/member combination, which could corrupt balance calculations.

**Fix:**
```sql
ALTER TABLE splits
ADD CONSTRAINT unique_split_per_member UNIQUE (expense_id, member_id);
```

---

### H2: Missing Self-Settlement Check

**Issue:** Nothing prevents a member from recording a settlement to themselves.

**Fix:**
```sql
ALTER TABLE settlements
ADD CONSTRAINT no_self_settlement CHECK (from_member_id != to_member_id);
```

---

### H3: Storage RLS - Receipts Bucket Too Permissive

**Location:** `20260124000001_fix_storage_buckets_rls.sql`

**Current Policy:**
```sql
CREATE POLICY "Users can update receipts"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');
```

**Impact:** Any authenticated user (or anon) can update/overwrite any receipt file.

**Fix:**
```sql
DROP POLICY IF EXISTS "Users can update receipts" ON storage.objects;

CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = get_clerk_user_id()
)
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = get_clerk_user_id()
);
```

---

### H4: Deprecated user_id Column

**Issue:** Legacy `members.user_id` UUID column exists alongside `clerk_user_id`. Code may inconsistently reference both.

**Action Plan:**
1. Audit codebase for `user_id` references: `grep -r "user_id" lib/ app/`
2. Update any remaining references to use `clerk_user_id`
3. Create migration to drop column after verification
4. Add NOT NULL constraint to `clerk_user_id`

---

### H5: Missing Index for Bidirectional Friendship Lookups

**Location:** Query patterns in `lib/friends.ts`

**Issue:** `getFriends()` makes two separate queries:
```typescript
.eq("requester_id", userId)
.eq("addressee_id", userId)
```

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_friendships_participants
ON friendships (requester_id, addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee
ON friendships (addressee_id, status);
```

---

## 3. Medium Priority Issues (Fix Within 1 Month)

### M1: N+1 Query Pattern in getGlobalBalances

**Location:** `lib/balances.ts` lines 194-230

**Current Code:**
```typescript
// Fetch all groups
const { data: groups } = await supabase.from("groups").select("*")...

// Process each group - N+1 PATTERN
for (const group of groups || []) {
  const groupBalance = await getGroupBalances(group.id);  // Query per group!
}
```

**Impact:** For users with 10 groups, this results in 30+ database queries.

**Fix:** Use the already-optimized `getGlobalBalancesForUser()` function (lines 462-663) exclusively.

---

### M2: Missing Index for Expense Date Range Queries

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_expenses_date
ON expenses(group_id, expense_date DESC)
WHERE deleted_at IS NULL;
```

---

### M3: receipt_items Missing updated_at Column

**Fix:**
```sql
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TRIGGER update_receipt_items_updated_at
  BEFORE UPDATE ON receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### M4: Inconsistent Timestamp Types

**Issue:** Some tables use explicit `TIMESTAMPTZ`, others rely on defaults.

**Recommendation:** Audit all timestamp columns and standardize to explicit `TIMESTAMPTZ`.

---

### M5: activity_log.metadata JSONB Not Validated

**Issue:** The `metadata` column accepts any JSON without schema validation.

**Recommendation:** Add CHECK constraint or consider validation trigger for known action types.

---

### M6: Missing Delete Policy on settlements

**Issue:** Settlements have INSERT, SELECT, UPDATE policies but no DELETE policy.

**Recommendation:** Either add explicit DELETE policy or document that deletions are intentionally blocked.

---

## 4. Low Priority Issues (Address When Convenient)

| ID | Issue | Recommendation |
|----|-------|----------------|
| L1 | Duplicate index definitions in baseline vs migrations | Use `IF NOT EXISTS` consistently |
| L2 | Inconsistent FK naming (`paid_by` vs `member_id`) | Document convention, apply to new tables |
| L3 | Missing table comments | Add COMMENT ON TABLE for all tables |
| L4 | Possibly unused `settlement_links` table | Verify usage, drop if unused |
| L5 | Missing parentheses in `day_of_week` CHECK | Clarify with explicit grouping |

---

## 5. Missing Constraints Inventory

| Table | Missing Constraint | Risk Level |
|-------|-------------------|------------|
| `splits` | `UNIQUE(expense_id, member_id)` | High |
| `splits` | `SUM(amount) = expense.amount` (trigger) | Medium |
| `item_claims` | `SUM(share_fraction) <= 1` per item (trigger) | Medium |
| `settlements` | `from_member_id != to_member_id` | High |
| `friendships` | `requester_id != addressee_id` | Low |

---

## 6. RLS Policy Summary

### Secure Tables (Membership-Based RLS)
- expenses
- splits
- settlements
- user_profiles
- friendships
- activity_log
- push_tokens
- receipts
- receipt_items
- item_claims
- receipt_member_totals
- recurring_expenses
- recurring_expense_splits
- payment_reminders
- reminder_history
- feedback

### Tables Requiring Fixes
| Table | Issue | Priority |
|-------|-------|----------|
| groups | SELECT USING(true) | Critical |
| members | Anon can read all | Critical |
| payment_events | Anon read/write | Critical |
| storage.objects | Too permissive UPDATE | High |

---

## 7. Performance Index Recommendations

### Recommended New Indexes
```sql
-- Expense date filtering
CREATE INDEX idx_expenses_group_date
ON expenses(group_id, expense_date DESC)
WHERE deleted_at IS NULL;

-- Settlement queries
CREATE INDEX idx_settlements_group_created
ON settlements(group_id, created_at DESC);

-- Faster member count queries
CREATE INDEX idx_members_group_count
ON members(group_id);

-- Friendship lookups
CREATE INDEX idx_friendships_participants
ON friendships (requester_id, addressee_id, status);
```

---

## 8. Action Plan Timeline

### Week 1 (Critical + High)
- [ ] Create migration: `20260201000001_fix_critical_rls_policies.sql`
  - Fix groups SELECT policy (C1)
  - Fix payment_events anon access (C2)
  - Fix members anon access (C3)
- [ ] Create migration: `20260201000002_add_data_integrity_constraints.sql`
  - Add unique constraint to splits (H1)
  - Add self-settlement check (H2)
- [ ] Create migration: `20260201000003_fix_storage_rls.sql`
  - Fix receipts bucket policies (H3)

### Week 2
- [ ] Audit and remove user_id references (H4)
- [ ] Add friendship indexes (H5)
- [ ] Refactor getGlobalBalances to use optimized function (M1)

### Week 3-4
- [ ] Add expense date index (M2)
- [ ] Add updated_at to receipt_items (M3)
- [ ] Standardize timestamp types (M4)
- [ ] Review activity_log metadata validation (M5)
- [ ] Document settlements delete policy decision (M6)

### Ongoing
- Address low priority items as encountered
- Update this document as issues are resolved

---

## 9. Migration File Template

```sql
-- Migration: YYYYMMDDHHMMSS_description.sql
-- Purpose: [Brief description]
-- Addresses: [Audit item IDs, e.g., C1, H2]

BEGIN;

-- Your migration SQL here

COMMIT;
```

---

## 10. Verification Queries

### Check for Duplicate Splits
```sql
SELECT expense_id, member_id, COUNT(*)
FROM splits
GROUP BY expense_id, member_id
HAVING COUNT(*) > 1;
```

### Check for Self-Settlements
```sql
SELECT * FROM settlements
WHERE from_member_id = to_member_id;
```

### Check RLS Policy Coverage
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

---

**Last Updated:** 2026-02-01
**Next Review:** 2026-02-15
