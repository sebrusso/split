# SplitFree Database Architecture Documentation

## 1. Current Database Schema Overview

The SplitFree backend uses Supabase (PostgreSQL) with **17 tables** organized into these functional areas:

### Core Expense-Splitting Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **groups** | Container for shared expenses | `id`, `name`, `emoji`, `currency`, `share_code` (unique), `pinned`, `archived_at` |
| **members** | People within groups | `id`, `group_id` (FK), `name`, `user_id` (FK to auth.users), `clerk_user_id` |
| **expenses** | Individual expense records | `id`, `group_id` (FK), `amount`, `paid_by` (FK to members), `category`, `split_type`, `deleted_at` (soft delete), `currency`, `exchange_rate` |
| **splits** | How expenses are divided | `id`, `expense_id` (FK), `member_id` (FK), `amount` |
| **settlements** | Payment records between members | `id`, `group_id` (FK), `from_member_id`, `to_member_id`, `amount`, `method`, `proof_url` |

### Receipt Scanning Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **receipts** | Scanned receipt metadata | `id`, `group_id` (FK), `uploaded_by` (FK), `image_url`, `ocr_status`, `ocr_provider`, `merchant_name`, `total_amount`, `status` |
| **receipt_items** | Line items from OCR | `id`, `receipt_id` (FK), `description`, `quantity`, `unit_price`, `total_price`, `is_tax`, `is_tip`, etc. |
| **item_claims** | Who claims which items | `id`, `receipt_item_id` (FK), `member_id` (FK), `claim_type` (full/split/partial), `share_fraction`, `claimed_via` |
| **receipt_member_totals** | Calculated per-member totals | `id`, `receipt_id` (FK), `member_id` (FK), `items_total`, `tax_share`, `tip_share`, `grand_total`, `is_settled` |

### Recurring Expense Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **recurring_expenses** | Template for auto-created expenses | `id`, `group_id` (FK), `paid_by` (FK), `amount`, `frequency`, `next_due_date`, `is_active` |
| **recurring_expense_splits** | Split template | `id`, `recurring_expense_id` (FK), `member_id` (FK), `amount`/`percentage`/`shares` |

### User & Social Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **user_profiles** | Extended user data | `id`, `clerk_id` (unique), `email`, `display_name`, `avatar_url`, `venmo_username`, `default_currency` |
| **friendships** | Friend connections | `id`, `requester_id`, `addressee_id`, `status` (pending/accepted/blocked) |
| **activity_log** | Audit trail / activity feed | `id`, `group_id` (FK), `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (JSONB) |

### Notification Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **push_tokens** | Device push notification tokens | `id`, `user_id`, `token` (unique), `platform` (ios/android/web) |
| **payment_reminders** | Scheduled payment reminders | `id`, `group_id` (FK), `from_member_id`, `to_member_id`, `amount`, `status`, `frequency` |
| **reminder_history** | Reminder delivery log | `id`, `reminder_id` (FK), `sent_at`, `channel`, `success` |

---

## 2. How the App Connects to the Database

### Supabase Client Initialization

The app initializes Supabase in `lib/supabase.ts`:
- Uses environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Exports a default client for anonymous/public access
- Provides `createAuthenticatedClient()` for RLS-protected operations using Clerk JWT tokens

### Database Operations by Feature Area

#### Groups & Members (`lib/balances.ts`, `lib/members.ts`, `lib/auth-utils.ts`)
- Groups are fetched with member lists
- Members can be "claimed" by authenticated users via `clerk_user_id` update
- Membership verification gates access to group data

#### Expense Management (`app/group/[id]/add-expense.tsx`, `app/group/[id]/expense/[expenseId].tsx`)
- Expenses inserted with corresponding splits in the same transaction
- Multi-currency support: stores `currency`, `exchange_rate`, `exchange_rate_time`
- Soft delete via `deleted_at` field (trash feature)
- Joins on `members` via `paid_by` foreign key

#### Balance Calculation (`lib/balances.ts`, `lib/utils.ts`)
- Fetches all expenses + splits + settlements for a group
- Calculates net balance per member (positive = owed money, negative = owes money)
- `simplifyDebts()` algorithm minimizes number of transactions to settle

#### Receipt Scanning (`lib/useReceipts.ts`, `lib/storage.ts`)
- Images uploaded to Supabase Storage `receipts` bucket
- Receipt metadata stored in `receipts` table with OCR status tracking
- **Real-time subscriptions** on `item_claims` for live claiming updates
- Member totals calculated and cached in `receipt_member_totals`

#### Activity Logging (`lib/activity.ts`)
- Logs actions: expense_added, expense_edited, expense_deleted, settlement_recorded, member_joined, group_created
- Joins with `user_profiles` for actor display names
- Supports group-level and global activity feeds

#### Friends (`lib/friends.ts`)
- Friend requests: pending → accepted/blocked status flow
- Joins with `user_profiles` for friend info display

#### Offline Support (`lib/useOffline.ts`, `lib/sync.ts`)
- SQLite local cache for groups, members, expenses, settlements
- Sync queue for offline operations
- Conflict resolution on sync

### Query Patterns Used

1. **Joins**: Extensive use of Supabase's `select()` with foreign key notation
   ```typescript
   .select(`*, payer:members!paid_by(id, name), splits(*)`)
   ```

2. **Real-time**: Subscriptions on `item_claims` for receipt claiming
   ```typescript
   supabase.channel('claims').on('postgres_changes', {...})
   ```

3. **Soft deletes**: `deleted_at IS NULL` filters on expenses

4. **Text search**: `ilike` for expense search functionality

---

## 3. Analysis: Issues and Recommendations

### A. Misconfigurations in How the App Works with the DB

#### 1. **Missing Tables Referenced in Code**

The TypeScript code references tables that may not exist in the database:

| Table | Referenced In | Issue |
|-------|--------------|-------|
| `user_profiles` | `lib/user-profile.ts`, `lib/friends.ts`, `lib/activity.ts` | Schema provided shows this table exists, but types suggest potential field mismatches |
| `activity_log` | `lib/activity.ts` | Used extensively but may lack proper indexes for `group_id` + `created_at` queries |
| `friendships` | `lib/friends.ts` | Uses `requester_id` and `addressee_id` as TEXT (clerk IDs) but no FK enforcement |

#### 2. **Type/Schema Mismatches**

| Issue | Details |
|-------|---------|
| `members.user_id` vs `members.clerk_user_id` | Dual authentication approach - `user_id` references `auth.users` but app uses Clerk (`clerk_user_id`). Confusion between auth systems. |
| `friendships` uses TEXT for user IDs | `requester_id` and `addressee_id` are TEXT (Clerk IDs) with no FK constraints, unlike other tables that use UUIDs with proper FKs |
| `push_tokens.user_id` is TEXT | Not linked to `user_profiles` or `members` via FK |

#### 3. **Potential Query Performance Issues**

The app makes these queries that may need optimization:

| Query Pattern | Location | Concern |
|---------------|----------|---------|
| `members WHERE clerk_user_id = ?` | Multiple files | No index specified on `clerk_user_id` |
| `activity_log WHERE group_id = ? ORDER BY created_at` | `lib/activity.ts` | Needs composite index |
| `expenses WHERE group_id = ? AND deleted_at IS NULL` | Multiple files | Needs composite index for soft-delete queries |

#### 4. **RLS Policy Concerns**

Per CLAUDE.md: "All tables have RLS enabled with public read/write policies for MVP"

This is a security risk for production:
- Any user can read/modify any data
- No ownership enforcement at the database level
- The app relies on client-side filtering, not database-enforced access control

---

### B. Suggested Database Changes

#### 1. **Add Missing Indexes**

```sql
-- For member lookup by Clerk ID
CREATE INDEX IF NOT EXISTS idx_members_clerk_user_id ON members(clerk_user_id);

-- For activity queries
CREATE INDEX IF NOT EXISTS idx_activity_log_group_created ON activity_log(group_id, created_at DESC);

-- For soft-delete expense queries
CREATE INDEX IF NOT EXISTS idx_expenses_group_not_deleted ON expenses(group_id) WHERE deleted_at IS NULL;

-- For receipt status queries
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(group_id, status);

-- For recurring expense processing
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date) WHERE is_active = true;
```

#### 2. **Add Missing Foreign Key Constraints**

```sql
-- Link friendships to user_profiles
ALTER TABLE friendships
  ADD CONSTRAINT friendships_requester_fk
  FOREIGN KEY (requester_id) REFERENCES user_profiles(clerk_id);

ALTER TABLE friendships
  ADD CONSTRAINT friendships_addressee_fk
  FOREIGN KEY (addressee_id) REFERENCES user_profiles(clerk_id);

-- Link push_tokens to user_profiles
ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_user_fk
  FOREIGN KEY (user_id) REFERENCES user_profiles(clerk_id);
```

#### 3. **Remove Redundant Fields**

The `members` table has both `user_id` (Supabase Auth) and `clerk_user_id` (Clerk). Since the app uses Clerk:
- Consider deprecating `user_id` field
- Or: Keep for backward compatibility but document which is canonical

#### 4. **Add Missing Tables (If Not Present)**

Based on the code, ensure these tables exist with proper structure:
- `user_profiles` - appears in schema
- `activity_log` - appears in schema
- `friendships` - appears in schema

#### 5. **Implement Proper RLS Policies**

Replace "public read/write" policies with proper ownership-based policies:

```sql
-- Example: Members can only access their own groups
CREATE POLICY "Users can view groups they belong to" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = groups.id
      AND members.clerk_user_id = auth.jwt()->>'clerk_user_id'
    )
  );

-- Example: Only group members can create expenses
CREATE POLICY "Group members can create expenses" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = expenses.group_id
      AND members.clerk_user_id = auth.jwt()->>'clerk_user_id'
    )
  );
```

---

### C. Summary of Recommended Actions

| Priority | Action | Rationale |
|----------|--------|-----------|
| **High** | Add index on `members.clerk_user_id` | Every authenticated request queries this |
| **High** | Implement proper RLS policies | Security - currently wide open |
| **Medium** | Add composite indexes for common queries | Performance at scale |
| **Medium** | Add FK constraints on `friendships`, `push_tokens` | Data integrity |
| **Low** | Deprecate `members.user_id` field | Code cleanup - app uses Clerk |
| **Low** | Add `updated_at` triggers | Consistency for audit/cache invalidation |

---

## 4. Tables Used vs. Defined

| Table | In Schema | Used by App | Notes |
|-------|-----------|-------------|-------|
| groups | Yes | Yes | Core table |
| members | Yes | Yes | Core table |
| expenses | Yes | Yes | Core table |
| splits | Yes | Yes | Core table |
| settlements | Yes | Yes | Core table |
| receipts | Yes | Yes | Receipt scanning |
| receipt_items | Yes | Yes | Receipt scanning |
| item_claims | Yes | Yes | Receipt claiming |
| receipt_member_totals | Yes | Partial | May be computed on-the-fly instead |
| recurring_expenses | Yes | Yes | Recurring feature |
| recurring_expense_splits | Yes | Yes | Recurring feature |
| user_profiles | Yes | Yes | User data with Clerk integration |
| friendships | Yes | Yes | Friends feature |
| activity_log | Yes | Yes | Activity feed |
| push_tokens | Yes | Minimal | Notification infrastructure |
| payment_reminders | Yes | Minimal | Reminder infrastructure |
| reminder_history | Yes | Minimal | Reminder delivery tracking |

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Native App                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  Groups  │  │  Expenses │  │ Receipts │  │   Balances    │   │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───────┬───────┘   │
│       │              │             │                │            │
└───────┼──────────────┼─────────────┼────────────────┼────────────┘
        │              │             │                │
        ▼              ▼             ▼                ▼
┌───────────────────────────────────────────────────────────────────┐
│                    lib/supabase.ts Client                         │
│  • Anonymous client (default)                                     │
│  • Authenticated client (with Clerk JWT for RLS)                  │
└───────────────────────────────────────────────────────────────────┘
        │              │             │                │
        ▼              ▼             ▼                ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                           │
│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────────────┐       │
│  │ groups │◄─┤ members │◄─┤ expenses │──┤     splits     │       │
│  └────────┘  └─────────┘  └──────────┘  └────────────────┘       │
│       │           │            │                                  │
│       │           │            ▼                                  │
│       │           │     ┌────────────┐     ┌────────────────┐    │
│       │           │     │ settlements│     │ activity_log   │    │
│       │           │     └────────────┘     └────────────────┘    │
│       │           │                                               │
│       ▼           ▼                                               │
│  ┌──────────┐  ┌───────────────┐                                 │
│  │ receipts │──┤ receipt_items │──► item_claims (real-time)      │
│  └──────────┘  └───────────────┘                                 │
└───────────────────────────────────────────────────────────────────┘
```

This document provides a comprehensive overview of the SplitFree database architecture, its integration with the app, and actionable recommendations for improvement.

---

## 6. Migrations Created

The following migrations have been created to address the issues identified in this document:

### `20260113000001_add_performance_indexes.sql`
Adds all performance indexes:
- `idx_members_clerk_user_id` - For member lookup by Clerk ID
- `idx_activity_log_group_created` - For activity feed queries
- `idx_activity_log_actor_id` - For user-specific activity
- `idx_expenses_group_not_deleted` - For soft-delete expense queries
- `idx_expenses_group_deleted` - For trash view
- `idx_receipts_group_status` - For receipt status queries
- `idx_receipts_uploaded_by` / `idx_receipts_uploaded_by_clerk` - For receipt lookups
- `idx_recurring_expenses_next_due_active` - For recurring expense processing
- `idx_user_profiles_clerk_id` - For profile lookups
- `idx_friendships_requester` / `idx_friendships_addressee` - For friendship queries
- `idx_push_tokens_user_id` - For push token lookups
- `idx_payment_reminders_group` / `idx_payment_reminders_scheduled` - For reminder queries
- `idx_item_claims_receipt_item` / `idx_item_claims_member` - For claim lookups

### `20260113000002_secure_rls_policies.sql`
Replaces wide-open "Allow public" policies with secure membership-based policies:
- Creates helper functions: `get_clerk_user_id()`, `is_group_member()`, `is_own_profile()`
- Secures all 17 tables with proper RLS policies
- Allows anonymous access only where needed (share codes, receipt sharing)
- Enforces group membership for all expense-related operations

### `20260113000003_add_updated_at_triggers.sql`
Adds consistency improvements:
- Creates `update_updated_at_column()` trigger function
- Adds triggers to all tables with `updated_at` columns
- Adds `updated_at` columns to tables missing them
- Documents deprecated `members.user_id` field with comments

### `20260113000004_add_fk_constraints_optional.sql` *(Optional)*
Adds foreign key constraints for data integrity:
- `friendships.requester_id` → `user_profiles.clerk_id`
- `friendships.addressee_id` → `user_profiles.clerk_id`
- `push_tokens.user_id` → `user_profiles.clerk_id`

**Note:** This migration checks for orphaned data before adding constraints. If orphaned records exist, it will skip the constraint and log a warning. See the migration file for cleanup queries.

### Running the Migrations

```bash
# Apply migrations to local Supabase
npx supabase db push

# Or run against remote
npx supabase db push --linked
```

**Important Notes:**
- The RLS policy migration (`20260113000002`) is a breaking change. Ensure all clients are authenticated before deploying to production.
- The FK constraints migration (`20260113000004`) is optional and will skip constraints if orphaned data exists. Check the migration warnings after running.
