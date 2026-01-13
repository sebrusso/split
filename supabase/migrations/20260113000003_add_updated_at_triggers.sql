-- Add updated_at Triggers and Column Comments
-- Purpose: Ensure updated_at is automatically maintained for audit/cache invalidation
-- Also documents the deprecated user_id field in members table

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADD UPDATED_AT TRIGGERS TO TABLES THAT HAVE THE COLUMN
-- ============================================

-- expenses table
DROP TRIGGER IF EXISTS set_expenses_updated_at ON public.expenses;
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- friendships table
DROP TRIGGER IF EXISTS set_friendships_updated_at ON public.friendships;
CREATE TRIGGER set_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- user_profiles table
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- push_tokens table
DROP TRIGGER IF EXISTS set_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER set_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- receipts table
DROP TRIGGER IF EXISTS set_receipts_updated_at ON public.receipts;
CREATE TRIGGER set_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- receipt_member_totals table
DROP TRIGGER IF EXISTS set_receipt_member_totals_updated_at ON public.receipt_member_totals;
CREATE TRIGGER set_receipt_member_totals_updated_at
  BEFORE UPDATE ON public.receipt_member_totals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- recurring_expenses table
DROP TRIGGER IF EXISTS set_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER set_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DOCUMENT DEPRECATED FIELDS
-- ============================================

-- Add comment to document that user_id is deprecated in favor of clerk_user_id
COMMENT ON COLUMN public.members.user_id IS
  'DEPRECATED: Legacy Supabase Auth user reference. Use clerk_user_id for Clerk authentication. This field is retained for backward compatibility but should not be used in new code.';

COMMENT ON COLUMN public.members.clerk_user_id IS
  'Clerk authentication user ID. This is the canonical user identifier used by the app. Maps to the Clerk user sub claim in JWT.';

-- ============================================
-- ADD UPDATED_AT COLUMN TO TABLES MISSING IT (if needed)
-- ============================================

-- Add updated_at to members if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'members'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.members ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_members_updated_at
      BEFORE UPDATE ON public.members
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add updated_at to groups if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'groups'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_groups_updated_at
      BEFORE UPDATE ON public.groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add updated_at to settlements if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'settlements'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.settlements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_settlements_updated_at
      BEFORE UPDATE ON public.settlements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add updated_at to splits if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'splits'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.splits ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_splits_updated_at
      BEFORE UPDATE ON public.splits
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add updated_at to activity_log if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'activity_log'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_activity_log_updated_at
      BEFORE UPDATE ON public.activity_log
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add updated_at to payment_reminders if not exists (it likely has it based on schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payment_reminders'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.payment_reminders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE TRIGGER set_payment_reminders_updated_at
      BEFORE UPDATE ON public.payment_reminders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
