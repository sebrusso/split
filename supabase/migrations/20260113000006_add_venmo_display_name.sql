-- Add Venmo display name column to user_profiles
-- Allows users to store their Venmo display name for profile preview

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS venmo_display_name TEXT;

COMMENT ON COLUMN user_profiles.venmo_display_name IS 'User-provided Venmo display name for profile preview';
