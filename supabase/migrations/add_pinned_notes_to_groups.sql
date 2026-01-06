-- Add pinned and notes columns to groups table
-- Phase 2C P1: Pin/Favorite Groups and Group Notes features

ALTER TABLE groups
ADD COLUMN pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN notes TEXT;

-- Create index on pinned for efficient sorting
CREATE INDEX idx_groups_pinned ON groups(pinned DESC, created_at DESC);

COMMENT ON COLUMN groups.pinned IS 'Whether the group is pinned to the top of the list';
COMMENT ON COLUMN groups.notes IS 'Optional notes about the group (e.g., trip details, event info)';
