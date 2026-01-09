-- Fix whitespace constraint to handle all whitespace characters (tabs, newlines, etc.)
-- PostgreSQL trim() only removes spaces, but we need to reject all-whitespace strings

-- Drop and recreate members constraint to catch tabs and newlines
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_name_not_empty;
ALTER TABLE members ADD CONSTRAINT members_name_not_empty
  CHECK (regexp_replace(name, '\s', '', 'g') != '');

-- Also fix groups constraint
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_not_empty;
ALTER TABLE groups ADD CONSTRAINT groups_name_not_empty
  CHECK (regexp_replace(name, '\s', '', 'g') != '');

-- And expenses constraint
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_description_not_empty;
ALTER TABLE expenses ADD CONSTRAINT expenses_description_not_empty
  CHECK (regexp_replace(description, '\s', '', 'g') != '');
