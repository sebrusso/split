-- Prevent duplicate member names within a group (case-insensitive)
-- This helps prevent race conditions when multiple users try to join with the same name

-- First, check if any duplicates exist and handle them
DO $$
BEGIN
  -- Update any duplicate names by appending a number
  WITH duplicates AS (
    SELECT id, group_id, name,
           ROW_NUMBER() OVER (PARTITION BY group_id, lower(name) ORDER BY created_at) as rn
    FROM members
  )
  UPDATE members m
  SET name = m.name || ' (' || d.rn || ')'
  FROM duplicates d
  WHERE m.id = d.id AND d.rn > 1;
END $$;

-- Create the unique index on (group_id, lower(name))
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_group_name_unique
ON members (group_id, lower(name));
