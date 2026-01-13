-- Add Performance Indexes
-- Purpose: Fix query performance issues identified in database architecture review
-- These indexes target the most frequently used query patterns in the app

-- ============================================
-- HIGH PRIORITY: Member lookup by Clerk ID
-- Used in: Every authenticated request to verify group membership
-- ============================================
CREATE INDEX IF NOT EXISTS idx_members_clerk_user_id
ON public.members (clerk_user_id)
WHERE clerk_user_id IS NOT NULL;

-- ============================================
-- MEDIUM PRIORITY: Activity feed queries
-- Used in: lib/activity.ts - getGroupActivity, getGlobalActivity
-- Query: activity_log WHERE group_id = ? ORDER BY created_at DESC
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activity_log_group_created
ON public.activity_log (group_id, created_at DESC);

-- Also index actor_id for user-specific activity lookups
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id
ON public.activity_log (actor_id);

-- ============================================
-- MEDIUM PRIORITY: Soft-delete expense queries
-- Used in: Multiple files - expense lists exclude deleted items
-- Query: expenses WHERE group_id = ? AND deleted_at IS NULL
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_group_not_deleted
ON public.expenses (group_id)
WHERE deleted_at IS NULL;

-- Also index for trash view (deleted expenses)
CREATE INDEX IF NOT EXISTS idx_expenses_group_deleted
ON public.expenses (group_id, deleted_at)
WHERE deleted_at IS NOT NULL;

-- ============================================
-- MEDIUM PRIORITY: Receipt status queries
-- Used in: Receipt listing and filtering by status
-- Query: receipts WHERE group_id = ? AND status = ?
-- ============================================
CREATE INDEX IF NOT EXISTS idx_receipts_group_status
ON public.receipts (group_id, status);

-- Index for receipts by uploader
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by
ON public.receipts (uploaded_by);

-- Index for receipts by clerk_id (for user's receipts across groups)
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by_clerk
ON public.receipts (uploaded_by_clerk_id)
WHERE uploaded_by_clerk_id IS NOT NULL;

-- ============================================
-- MEDIUM PRIORITY: Recurring expense processing
-- Used in: Cron job to process due recurring expenses
-- Query: recurring_expenses WHERE next_due_date <= ? AND is_active = true
-- ============================================
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due_active
ON public.recurring_expenses (next_due_date)
WHERE is_active = true;

-- ============================================
-- LOW PRIORITY: User profile lookups
-- Used in: lib/user-profile.ts, lib/friends.ts
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id
ON public.user_profiles (clerk_id);

-- ============================================
-- LOW PRIORITY: Friendship lookups
-- Used in: lib/friends.ts - getFriendsList, getPendingRequests
-- ============================================
CREATE INDEX IF NOT EXISTS idx_friendships_requester
ON public.friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee
ON public.friendships (addressee_id, status);

-- ============================================
-- LOW PRIORITY: Push token lookups
-- Used in: Notification system
-- ============================================
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
ON public.push_tokens (user_id);

-- ============================================
-- LOW PRIORITY: Payment reminder queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_reminders_group
ON public.payment_reminders (group_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled
ON public.payment_reminders (scheduled_at)
WHERE status = 'pending';

-- ============================================
-- Receipt item claims - for real-time updates
-- ============================================
CREATE INDEX IF NOT EXISTS idx_item_claims_receipt_item
ON public.item_claims (receipt_item_id);

CREATE INDEX IF NOT EXISTS idx_item_claims_member
ON public.item_claims (member_id);
