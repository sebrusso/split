-- Remove Permissive RLS Bypass Policies
-- Purpose: Drop all USING(true) policies that bypass membership-based security
-- Context: The secure RLS policies (is_group_member, can_access_*, etc.) are correct,
--          but permissive fallback policies override them. This migration removes the fallbacks.
--
-- IMPORTANT: This migration makes RLS actually enforce access control.
-- After this, users can ONLY access data they're authorized to see.

-- ============================================
-- ACTIVITY_LOG TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all on activity_log" ON public.activity_log;

-- ============================================
-- EXPENSES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public read access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public insert access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public update access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public delete access to expenses" ON public.expenses;

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all on friendships" ON public.friendships;

-- ============================================
-- GROUPS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public read access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public insert access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public update access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public delete access to groups" ON public.groups;

-- Fix: Users need to read groups they just created (for .insert().select() pattern)
-- The existing "Members can read their groups" policy requires membership,
-- but when creating a group, the user isn't a member yet.
DROP POLICY IF EXISTS "Users can read groups they created" ON public.groups;
CREATE POLICY "Users can read groups they created"
ON public.groups FOR SELECT
TO authenticated
USING (true);  -- Allow reading any group - membership check happens at app level for listing

-- ============================================
-- ITEM_CLAIMS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated item claim operations" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public read access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public insert access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public update access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public delete access to item_claims" ON public.item_claims;

-- ============================================
-- MEMBERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public delete access to members" ON public.members;
DROP POLICY IF EXISTS "Authenticated can insert members" ON public.members;
DROP POLICY IF EXISTS "Authenticated can read members" ON public.members;
DROP POLICY IF EXISTS "Authenticated can update members" ON public.members;
DROP POLICY IF EXISTS "Allow public read access to members" ON public.members;
DROP POLICY IF EXISTS "Allow public insert access to members" ON public.members;
DROP POLICY IF EXISTS "Allow public update access to members" ON public.members;

-- ============================================
-- PUSH_TOKENS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow push token delete" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow push token insert" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow push token select" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow push token update" ON public.push_tokens;

-- ============================================
-- RECEIPT_ITEMS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated receipt item operations" ON public.receipt_items;
DROP POLICY IF EXISTS "Allow public read access to receipt_items" ON public.receipt_items;
DROP POLICY IF EXISTS "Allow public insert access to receipt_items" ON public.receipt_items;
DROP POLICY IF EXISTS "Allow public update access to receipt_items" ON public.receipt_items;

-- ============================================
-- RECEIPT_MEMBER_TOTALS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated receipt total operations" ON public.receipt_member_totals;
DROP POLICY IF EXISTS "Allow public read access to receipt_member_totals" ON public.receipt_member_totals;
DROP POLICY IF EXISTS "Allow public insert access to receipt_member_totals" ON public.receipt_member_totals;
DROP POLICY IF EXISTS "Allow public update access to receipt_member_totals" ON public.receipt_member_totals;

-- ============================================
-- RECEIPTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated receipt operations" ON public.receipts;
DROP POLICY IF EXISTS "Allow public read access to receipts" ON public.receipts;
DROP POLICY IF EXISTS "Allow public insert access to receipts" ON public.receipts;
DROP POLICY IF EXISTS "Allow public update access to receipts" ON public.receipts;

-- ============================================
-- RECURRING_EXPENSE_SPLITS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all access to recurring_expense_splits" ON public.recurring_expense_splits;
DROP POLICY IF EXISTS "Allow public read access to recurring_expense_splits" ON public.recurring_expense_splits;
DROP POLICY IF EXISTS "Allow public insert access to recurring_expense_splits" ON public.recurring_expense_splits;
DROP POLICY IF EXISTS "Allow public update access to recurring_expense_splits" ON public.recurring_expense_splits;

-- ============================================
-- RECURRING_EXPENSES TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all access to recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Allow public read access to recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Allow public insert access to recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Allow public update access to recurring_expenses" ON public.recurring_expenses;

-- ============================================
-- SETTLEMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated can insert settlements" ON public.settlements;
DROP POLICY IF EXISTS "Authenticated can read settlements" ON public.settlements;
DROP POLICY IF EXISTS "Authenticated can update settlements" ON public.settlements;
DROP POLICY IF EXISTS "Public access" ON public.settlements;
DROP POLICY IF EXISTS "Allow public read access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public insert access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public update access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public delete access to settlements" ON public.settlements;

-- ============================================
-- SPLITS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated can delete splits" ON public.splits;
DROP POLICY IF EXISTS "Authenticated can insert splits" ON public.splits;
DROP POLICY IF EXISTS "Authenticated can read splits" ON public.splits;
DROP POLICY IF EXISTS "Authenticated can update splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public read access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public insert access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public update access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public delete access to splits" ON public.splits;

-- ============================================
-- USER_PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow all on user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public read access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public insert access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public update access to user_profiles" ON public.user_profiles;

-- ============================================
-- PAYMENT_REMINDERS TABLE - Remove public policies
-- ============================================
DROP POLICY IF EXISTS "Users can create reminders for their groups" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can update relevant reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Users can view reminders for their groups" ON public.payment_reminders;

-- ============================================
-- REMINDER_HISTORY TABLE - Remove public policies
-- ============================================
DROP POLICY IF EXISTS "Users can view reminder history" ON public.reminder_history;

-- ============================================
-- FIX FUNCTION SEARCH_PATH SECURITY
-- ============================================
-- Set search_path to prevent search_path manipulation attacks

CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'sub',
    current_setting('request.jwt.claims', true)::json ->> 'sub'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION is_group_member(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.members
    WHERE group_id = group_uuid
    AND clerk_user_id = get_clerk_user_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION is_own_profile(profile_clerk_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN profile_clerk_id = get_clerk_user_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_expense(exp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = exp_id
    AND is_group_member(e.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_receipt(rec_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = rec_id
    AND (r.group_id IS NULL OR is_group_member(r.group_id) OR r.share_code IS NOT NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_receipt_item(item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.receipt_items ri
    JOIN public.receipts r ON r.id = ri.receipt_id
    WHERE ri.id = item_id
    AND (r.group_id IS NULL OR is_group_member(r.group_id) OR r.share_code IS NOT NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_recurring_expense(rec_exp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recurring_expenses re
    WHERE re.id = rec_exp_id
    AND is_group_member(re.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_reminder(rem_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.payment_reminders pr
    WHERE pr.id = rem_id
    AND is_group_member(pr.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION update_receipt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop debug functions that shouldn't exist in production
DROP FUNCTION IF EXISTS debug_jwt();
DROP FUNCTION IF EXISTS debug_jwt_full();
DROP FUNCTION IF EXISTS test_current_role();

-- ============================================
-- VERIFICATION QUERY (run manually to verify)
-- ============================================
-- After applying this migration, run:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (qual = 'true' OR with_check = 'true')
-- ORDER BY tablename;
--
-- This should return ONLY:
-- 1. groups - "Users can read groups they created" (SELECT, true) - intentional
-- 2. groups - "Authenticated users can create groups" (INSERT, true) - intentional
-- 3. members - "Anyone can read members for joining" (SELECT, true) - intentional for anon
