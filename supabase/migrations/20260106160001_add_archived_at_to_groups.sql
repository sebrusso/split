-- Add archived_at column to groups table
-- This allows groups to be soft-archived instead of deleted
-- Archived groups are hidden from the main list by default
-- but can still be accessed if needed

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create an index for faster queries filtering out archived groups
CREATE INDEX IF NOT EXISTS idx_groups_archived_at ON groups(archived_at);

-- Add a comment to document the field
COMMENT ON COLUMN groups.archived_at IS 'Timestamp when the group was archived. NULL means the group is active.';
