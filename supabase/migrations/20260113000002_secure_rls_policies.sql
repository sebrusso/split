-- Secure RLS Policies
-- Purpose: Replace wide-open "Allow public" policies with proper membership-based security
-- CRITICAL: This migration enforces data access control at the database level

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get the current user's Clerk ID from JWT
CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'sub',
    current_setting('request.jwt.claims', true)::json ->> 'sub'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a member of a group
CREATE OR REPLACE FUNCTION is_group_member(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE group_id = group_uuid
    AND clerk_user_id = get_clerk_user_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user owns a user_profile
CREATE OR REPLACE FUNCTION is_own_profile(profile_clerk_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN profile_clerk_id = get_clerk_user_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- GROUPS TABLE - Secure Policies
-- ============================================

-- Drop existing wide-open policies
DROP POLICY IF EXISTS "Allow public read access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public insert access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public update access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public delete access to groups" ON public.groups;

-- Anyone can create a group (they become the first member)
CREATE POLICY "Authenticated users can create groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Anonymous users can read groups by share_code (for joining)
CREATE POLICY "Anyone can read groups by share_code"
ON public.groups FOR SELECT
TO anon
USING (share_code IS NOT NULL);

-- Members can read their groups
CREATE POLICY "Members can read their groups"
ON public.groups FOR SELECT
TO authenticated
USING (is_group_member(id));

-- Members can update their groups
CREATE POLICY "Members can update their groups"
ON public.groups FOR UPDATE
TO authenticated
USING (is_group_member(id))
WITH CHECK (is_group_member(id));

-- ============================================
-- MEMBERS TABLE - Secure Policies
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to members" ON public.members;
DROP POLICY IF EXISTS "Allow public insert access to members" ON public.members;
DROP POLICY IF EXISTS "Allow public update access to members" ON public.members;
DROP POLICY IF EXISTS "Members can update own record" ON public.members;

-- Group members can add new members
-- OR: First member of a new group (no existing members yet)
CREATE POLICY "Group members can add members"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  is_group_member(group_id)
  OR NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = members.group_id)
);

-- Anonymous can read members (for share code joining flow)
CREATE POLICY "Anyone can read members for joining"
ON public.members FOR SELECT
TO anon
USING (true);

-- Group members can read other members in their groups
CREATE POLICY "Group members can read members"
ON public.members FOR SELECT
TO authenticated
USING (is_group_member(group_id));

-- Users can update their own member record (to claim membership)
CREATE POLICY "Users can update own member record"
ON public.members FOR UPDATE
TO authenticated
USING (clerk_user_id IS NULL OR clerk_user_id = get_clerk_user_id())
WITH CHECK (clerk_user_id = get_clerk_user_id());

-- ============================================
-- EXPENSES TABLE - Secure Policies
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public insert access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public update access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public delete access to expenses" ON public.expenses;

CREATE POLICY "Group members can create expenses"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can read expenses"
ON public.expenses FOR SELECT
TO authenticated
USING (is_group_member(group_id));

CREATE POLICY "Group members can update expenses"
ON public.expenses FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can delete expenses"
ON public.expenses FOR DELETE
TO authenticated
USING (is_group_member(group_id));

-- ============================================
-- SPLITS TABLE - Secure Policies
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public insert access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public update access to splits" ON public.splits;
DROP POLICY IF EXISTS "Allow public delete access to splits" ON public.splits;

-- Helper: Check if user has access to an expense
CREATE OR REPLACE FUNCTION can_access_expense(exp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = exp_id
    AND is_group_member(e.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Group members can create splits"
ON public.splits FOR INSERT
TO authenticated
WITH CHECK (can_access_expense(expense_id));

CREATE POLICY "Group members can read splits"
ON public.splits FOR SELECT
TO authenticated
USING (can_access_expense(expense_id));

CREATE POLICY "Group members can update splits"
ON public.splits FOR UPDATE
TO authenticated
USING (can_access_expense(expense_id))
WITH CHECK (can_access_expense(expense_id));

CREATE POLICY "Group members can delete splits"
ON public.splits FOR DELETE
TO authenticated
USING (can_access_expense(expense_id));

-- ============================================
-- SETTLEMENTS TABLE - Secure Policies
-- ============================================

DROP POLICY IF EXISTS "Allow public read access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public insert access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public update access to settlements" ON public.settlements;
DROP POLICY IF EXISTS "Allow public delete access to settlements" ON public.settlements;

CREATE POLICY "Group members can create settlements"
ON public.settlements FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can read settlements"
ON public.settlements FOR SELECT
TO authenticated
USING (is_group_member(group_id));

CREATE POLICY "Group members can update settlements"
ON public.settlements FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));

-- ============================================
-- USER_PROFILES TABLE - Secure Policies
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public insert access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public update access to user_profiles" ON public.user_profiles;

-- Users can create their own profile
CREATE POLICY "Users can create own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (clerk_id = get_clerk_user_id());

-- Users can read profiles of people in their groups (for display names, avatars)
CREATE POLICY "Users can read profiles in their groups"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  clerk_id = get_clerk_user_id()
  OR EXISTS (
    SELECT 1 FROM members m1
    JOIN members m2 ON m1.group_id = m2.group_id
    WHERE m1.clerk_user_id = get_clerk_user_id()
    AND m2.clerk_user_id = clerk_id
  )
);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (clerk_id = get_clerk_user_id())
WITH CHECK (clerk_id = get_clerk_user_id());

-- ============================================
-- FRIENDSHIPS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to friendships" ON public.friendships;
DROP POLICY IF EXISTS "Allow public insert access to friendships" ON public.friendships;
DROP POLICY IF EXISTS "Allow public update access to friendships" ON public.friendships;

-- Users can send friend requests
CREATE POLICY "Users can create friend requests"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (requester_id = get_clerk_user_id());

-- Users can see friendships they're part of
CREATE POLICY "Users can read own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (requester_id = get_clerk_user_id() OR addressee_id = get_clerk_user_id());

-- Users can update friendships they're the addressee of (accept/reject)
-- Or requester can cancel their own request
CREATE POLICY "Users can update friendships"
ON public.friendships FOR UPDATE
TO authenticated
USING (requester_id = get_clerk_user_id() OR addressee_id = get_clerk_user_id())
WITH CHECK (requester_id = get_clerk_user_id() OR addressee_id = get_clerk_user_id());

-- Users can delete their own friend requests or friendships they're part of
CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (requester_id = get_clerk_user_id() OR addressee_id = get_clerk_user_id());

-- ============================================
-- ACTIVITY_LOG TABLE - Secure Policies
-- ============================================

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Allow public insert access to activity_log" ON public.activity_log;

-- System/app can insert activity (through service role or authenticated users for their actions)
CREATE POLICY "Authenticated users can log activity"
ON public.activity_log FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = get_clerk_user_id()
  AND (group_id IS NULL OR is_group_member(group_id))
);

-- Users can read activity for their groups
CREATE POLICY "Users can read activity for their groups"
ON public.activity_log FOR SELECT
TO authenticated
USING (
  group_id IS NULL AND actor_id = get_clerk_user_id()
  OR is_group_member(group_id)
);

-- ============================================
-- PUSH_TOKENS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow public read access to push_tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow public insert access to push_tokens" ON public.push_tokens;

-- Users can manage only their own push tokens
CREATE POLICY "Users can insert own push tokens"
ON public.push_tokens FOR INSERT
TO authenticated
WITH CHECK (user_id = get_clerk_user_id());

CREATE POLICY "Users can read own push tokens"
ON public.push_tokens FOR SELECT
TO authenticated
USING (user_id = get_clerk_user_id());

CREATE POLICY "Users can update own push tokens"
ON public.push_tokens FOR UPDATE
TO authenticated
USING (user_id = get_clerk_user_id())
WITH CHECK (user_id = get_clerk_user_id());

CREATE POLICY "Users can delete own push tokens"
ON public.push_tokens FOR DELETE
TO authenticated
USING (user_id = get_clerk_user_id());

-- ============================================
-- RECEIPTS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to receipts" ON public.receipts;
DROP POLICY IF EXISTS "Allow public insert access to receipts" ON public.receipts;
DROP POLICY IF EXISTS "Allow public update access to receipts" ON public.receipts;
DROP POLICY IF EXISTS "Anyone can view receipts" ON public.receipts;
DROP POLICY IF EXISTS "Anyone can create receipts" ON public.receipts;
DROP POLICY IF EXISTS "Anyone can update receipts" ON public.receipts;

-- Group members can create receipts
CREATE POLICY "Group members can create receipts"
ON public.receipts FOR INSERT
TO authenticated
WITH CHECK (
  group_id IS NULL
  OR is_group_member(group_id)
);

-- Group members can read receipts
-- Also allow reading by share_code for receipt sharing feature
CREATE POLICY "Group members can read receipts"
ON public.receipts FOR SELECT
TO authenticated
USING (
  group_id IS NULL
  OR is_group_member(group_id)
  OR share_code IS NOT NULL
);

-- Anonymous can read receipts by share_code
CREATE POLICY "Anyone can read shared receipts"
ON public.receipts FOR SELECT
TO anon
USING (share_code IS NOT NULL);

-- Group members can update receipts
CREATE POLICY "Group members can update receipts"
ON public.receipts FOR UPDATE
TO authenticated
USING (group_id IS NULL OR is_group_member(group_id))
WITH CHECK (group_id IS NULL OR is_group_member(group_id));

-- ============================================
-- RECEIPT_ITEMS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to receipt_items" ON public.receipt_items;
DROP POLICY IF EXISTS "Allow public insert access to receipt_items" ON public.receipt_items;
DROP POLICY IF EXISTS "Allow public update access to receipt_items" ON public.receipt_items;
DROP POLICY IF EXISTS "Anyone can view receipt items" ON public.receipt_items;
DROP POLICY IF EXISTS "Anyone can create receipt items" ON public.receipt_items;
DROP POLICY IF EXISTS "Anyone can update receipt items" ON public.receipt_items;

-- Helper: Check if user can access a receipt
CREATE OR REPLACE FUNCTION can_access_receipt(rec_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM receipts r
    WHERE r.id = rec_id
    AND (r.group_id IS NULL OR is_group_member(r.group_id) OR r.share_code IS NOT NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can read receipt items"
ON public.receipt_items FOR SELECT
TO authenticated
USING (can_access_receipt(receipt_id));

-- Anonymous can read items for shared receipts
CREATE POLICY "Anyone can read shared receipt items"
ON public.receipt_items FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM receipts r
    WHERE r.id = receipt_id AND r.share_code IS NOT NULL
  )
);

CREATE POLICY "Users can insert receipt items"
ON public.receipt_items FOR INSERT
TO authenticated
WITH CHECK (can_access_receipt(receipt_id));

CREATE POLICY "Users can update receipt items"
ON public.receipt_items FOR UPDATE
TO authenticated
USING (can_access_receipt(receipt_id))
WITH CHECK (can_access_receipt(receipt_id));

-- ============================================
-- ITEM_CLAIMS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.item_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public insert access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public update access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Allow public delete access to item_claims" ON public.item_claims;
DROP POLICY IF EXISTS "Anyone can view item claims" ON public.item_claims;
DROP POLICY IF EXISTS "Anyone can create item claims" ON public.item_claims;
DROP POLICY IF EXISTS "Anyone can update item claims" ON public.item_claims;
DROP POLICY IF EXISTS "Anyone can delete item claims" ON public.item_claims;

-- Helper: Check if user can access a receipt item
CREATE OR REPLACE FUNCTION can_access_receipt_item(item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM receipt_items ri
    JOIN receipts r ON r.id = ri.receipt_id
    WHERE ri.id = item_id
    AND (r.group_id IS NULL OR is_group_member(r.group_id) OR r.share_code IS NOT NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can read item claims"
ON public.item_claims FOR SELECT
TO authenticated
USING (can_access_receipt_item(receipt_item_id));

-- Anonymous can read claims for shared receipts
CREATE POLICY "Anyone can read shared item claims"
ON public.item_claims FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM receipt_items ri
    JOIN receipts r ON r.id = ri.receipt_id
    WHERE ri.id = receipt_item_id AND r.share_code IS NOT NULL
  )
);

CREATE POLICY "Users can create item claims"
ON public.item_claims FOR INSERT
TO authenticated
WITH CHECK (can_access_receipt_item(receipt_item_id));

CREATE POLICY "Users can update own item claims"
ON public.item_claims FOR UPDATE
TO authenticated
USING (can_access_receipt_item(receipt_item_id))
WITH CHECK (can_access_receipt_item(receipt_item_id));

CREATE POLICY "Users can delete item claims"
ON public.item_claims FOR DELETE
TO authenticated
USING (can_access_receipt_item(receipt_item_id));

-- ============================================
-- RECEIPT_MEMBER_TOTALS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.receipt_member_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to receipt_member_totals" ON public.receipt_member_totals;
DROP POLICY IF EXISTS "Allow public insert access to receipt_member_totals" ON public.receipt_member_totals;
DROP POLICY IF EXISTS "Allow public update access to receipt_member_totals" ON public.receipt_member_totals;

CREATE POLICY "Users can read receipt member totals"
ON public.receipt_member_totals FOR SELECT
TO authenticated
USING (can_access_receipt(receipt_id));

CREATE POLICY "Users can insert receipt member totals"
ON public.receipt_member_totals FOR INSERT
TO authenticated
WITH CHECK (can_access_receipt(receipt_id));

CREATE POLICY "Users can update receipt member totals"
ON public.receipt_member_totals FOR UPDATE
TO authenticated
USING (can_access_receipt(receipt_id))
WITH CHECK (can_access_receipt(receipt_id));

-- ============================================
-- RECURRING_EXPENSES TABLE - Secure Policies
-- ============================================

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Allow public insert access to recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Allow public update access to recurring_expenses" ON public.recurring_expenses;

CREATE POLICY "Group members can create recurring expenses"
ON public.recurring_expenses FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can read recurring expenses"
ON public.recurring_expenses FOR SELECT
TO authenticated
USING (is_group_member(group_id));

CREATE POLICY "Group members can update recurring expenses"
ON public.recurring_expenses FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can delete recurring expenses"
ON public.recurring_expenses FOR DELETE
TO authenticated
USING (is_group_member(group_id));

-- ============================================
-- RECURRING_EXPENSE_SPLITS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.recurring_expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to recurring_expense_splits" ON public.recurring_expense_splits;
DROP POLICY IF EXISTS "Allow public insert access to recurring_expense_splits" ON public.recurring_expense_splits;
DROP POLICY IF EXISTS "Allow public update access to recurring_expense_splits" ON public.recurring_expense_splits;

-- Helper: Check if user can access a recurring expense
CREATE OR REPLACE FUNCTION can_access_recurring_expense(rec_exp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM recurring_expenses re
    WHERE re.id = rec_exp_id
    AND is_group_member(re.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Group members can manage recurring expense splits"
ON public.recurring_expense_splits FOR ALL
TO authenticated
USING (can_access_recurring_expense(recurring_expense_id))
WITH CHECK (can_access_recurring_expense(recurring_expense_id));

-- ============================================
-- PAYMENT_REMINDERS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to payment_reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Allow public insert access to payment_reminders" ON public.payment_reminders;
DROP POLICY IF EXISTS "Allow public update access to payment_reminders" ON public.payment_reminders;

CREATE POLICY "Group members can create payment reminders"
ON public.payment_reminders FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can read payment reminders"
ON public.payment_reminders FOR SELECT
TO authenticated
USING (is_group_member(group_id));

CREATE POLICY "Group members can update payment reminders"
ON public.payment_reminders FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));

-- ============================================
-- REMINDER_HISTORY TABLE - Secure Policies
-- ============================================

ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to reminder_history" ON public.reminder_history;
DROP POLICY IF EXISTS "Allow public insert access to reminder_history" ON public.reminder_history;
DROP POLICY IF EXISTS "Users can read reminder history for their groups" ON public.reminder_history;
DROP POLICY IF EXISTS "System can insert reminder history" ON public.reminder_history;

-- Helper: Check if user can access a reminder
CREATE OR REPLACE FUNCTION can_access_reminder(rem_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM payment_reminders pr
    WHERE pr.id = rem_id
    AND is_group_member(pr.group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can read reminder history for their groups"
ON public.reminder_history FOR SELECT
TO authenticated
USING (can_access_reminder(reminder_id));

-- System inserts reminder history (service role)
CREATE POLICY "System can insert reminder history"
ON public.reminder_history FOR INSERT
TO authenticated
WITH CHECK (can_access_reminder(reminder_id));
