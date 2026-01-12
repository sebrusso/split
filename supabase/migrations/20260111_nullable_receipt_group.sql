-- Allow receipts to exist without a group initially (draft/unassigned state)
-- This enables the group-agnostic scanning flow where users scan first, assign group later

-- Make group_id nullable
ALTER TABLE receipts ALTER COLUMN group_id DROP NOT NULL;

-- Make uploaded_by nullable (will use uploaded_by_clerk_id for unassigned receipts)
ALTER TABLE receipts ALTER COLUMN uploaded_by DROP NOT NULL;

-- Add clerk user ID for tracking unassigned receipt ownership
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS uploaded_by_clerk_id TEXT;

-- Add index for finding user's unassigned receipts efficiently
CREATE INDEX IF NOT EXISTS idx_receipts_unassigned
  ON receipts(uploaded_by_clerk_id)
  WHERE group_id IS NULL;

-- Add index for clerk user ID lookups
CREATE INDEX IF NOT EXISTS idx_receipts_clerk_user
  ON receipts(uploaded_by_clerk_id)
  WHERE uploaded_by_clerk_id IS NOT NULL;
