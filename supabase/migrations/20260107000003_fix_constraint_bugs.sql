-- Fix database constraint bugs exposed by integration tests
-- This migration adds missing validation constraints

-- ============================================
-- 0. Clean up invalid data from test runs
-- ============================================

-- Delete groups with empty/whitespace names or share codes (test artifacts)
DELETE FROM groups WHERE trim(name) = '' OR name IS NULL OR trim(share_code) = '' OR share_code IS NULL;

-- Truncate overly long group names
UPDATE groups SET name = left(name, 255) WHERE length(name) > 255;

-- Delete members with empty/whitespace names
DELETE FROM members WHERE trim(name) = '' OR name IS NULL;

-- Truncate overly long member names
UPDATE members SET name = left(name, 255) WHERE length(name) > 255;

-- Update expenses with empty descriptions to have a placeholder
UPDATE expenses SET description = 'Untitled Expense' WHERE trim(description) = '' OR description IS NULL;

-- Truncate overly long expense descriptions
UPDATE expenses SET description = left(description, 1000) WHERE length(description) > 1000;

-- Truncate overly long expense notes
UPDATE expenses SET notes = left(notes, 2000) WHERE notes IS NOT NULL AND length(notes) > 2000;

-- Delete self-settlements (from_member = to_member)
DELETE FROM settlements WHERE from_member_id = to_member_id;

-- Delete self-friendships (if table exists)
DO $$
BEGIN
  DELETE FROM friendships WHERE requester_id = addressee_id;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- ============================================
-- 1. Empty String Validation
-- ============================================

-- Groups: name cannot be empty or whitespace-only
ALTER TABLE groups ADD CONSTRAINT groups_name_not_empty
  CHECK (trim(name) != '');

-- Groups: share_code cannot be empty
ALTER TABLE groups ADD CONSTRAINT groups_share_code_not_empty
  CHECK (trim(share_code) != '');

-- Members: name cannot be empty or whitespace-only
ALTER TABLE members ADD CONSTRAINT members_name_not_empty
  CHECK (trim(name) != '');

-- Expenses: description cannot be empty or whitespace-only
ALTER TABLE expenses ADD CONSTRAINT expenses_description_not_empty
  CHECK (trim(description) != '');

-- ============================================
-- 2. Self-Reference Prevention
-- ============================================

-- Settlements: cannot pay yourself
ALTER TABLE settlements ADD CONSTRAINT settlements_no_self_payment
  CHECK (from_member_id != to_member_id);

-- Friendships: cannot friend yourself
ALTER TABLE friendships ADD CONSTRAINT friendships_no_self_friend
  CHECK (requester_id != addressee_id);

-- ============================================
-- 3. Duplicate Prevention
-- ============================================

-- Splits: only one split per member per expense
-- Use DO block to handle case where constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'splits_unique_member_expense'
  ) THEN
    ALTER TABLE splits ADD CONSTRAINT splits_unique_member_expense
      UNIQUE (expense_id, member_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 4. String Length Limits
-- ============================================

-- Groups: reasonable name length
ALTER TABLE groups ADD CONSTRAINT groups_name_max_length
  CHECK (length(name) <= 255);

-- Members: reasonable name length
ALTER TABLE members ADD CONSTRAINT members_name_max_length
  CHECK (length(name) <= 255);

-- Expenses: reasonable description length
ALTER TABLE expenses ADD CONSTRAINT expenses_description_max_length
  CHECK (length(description) <= 1000);

-- Expenses: reasonable notes length
DO $$
BEGIN
  ALTER TABLE expenses ADD CONSTRAINT expenses_notes_max_length
    CHECK (notes IS NULL OR length(notes) <= 2000);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 5. Comments for documentation
-- ============================================

COMMENT ON CONSTRAINT groups_name_not_empty ON groups IS 'Group names cannot be empty or whitespace-only';
COMMENT ON CONSTRAINT groups_share_code_not_empty ON groups IS 'Share codes cannot be empty';
COMMENT ON CONSTRAINT members_name_not_empty ON members IS 'Member names cannot be empty or whitespace-only';
COMMENT ON CONSTRAINT expenses_description_not_empty ON expenses IS 'Expense descriptions cannot be empty or whitespace-only';
COMMENT ON CONSTRAINT settlements_no_self_payment ON settlements IS 'Members cannot record settlements to themselves';
COMMENT ON CONSTRAINT friendships_no_self_friend ON friendships IS 'Users cannot send friend requests to themselves';
