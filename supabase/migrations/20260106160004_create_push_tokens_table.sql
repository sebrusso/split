-- Create push_tokens table for storing device push notification tokens
-- This table stores Expo push tokens for each user's device
--
-- Table structure:
-- - id: Primary key
-- - user_id: Reference to Clerk user ID (not a foreign key since Clerk is external)
-- - token: The Expo push token string
-- - platform: Device platform (ios, android, web)
-- - created_at: When the token was first registered
-- - updated_at: When the token was last updated
--
-- A user can have multiple tokens (multiple devices)
-- Tokens should be unique across the system

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- Create index on token for faster uniqueness checks
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own push tokens
CREATE POLICY "Users can read own push tokens"
ON push_tokens
FOR SELECT
USING (auth.jwt() ->> 'sub' = user_id);

-- Policy: Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens"
ON push_tokens
FOR INSERT
WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Policy: Users can update their own push tokens
CREATE POLICY "Users can update own push tokens"
ON push_tokens
FOR UPDATE
USING (auth.jwt() ->> 'sub' = user_id)
WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Policy: Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens"
ON push_tokens
FOR DELETE
USING (auth.jwt() ->> 'sub' = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER push_tokens_updated_at
BEFORE UPDATE ON push_tokens
FOR EACH ROW
EXECUTE FUNCTION update_push_tokens_updated_at();

-- Add comment to table
COMMENT ON TABLE push_tokens IS 'Stores Expo push notification tokens for user devices';
COMMENT ON COLUMN push_tokens.user_id IS 'Clerk user ID (external to Supabase)';
COMMENT ON COLUMN push_tokens.token IS 'Expo push token (ExponentPushToken[...])';
COMMENT ON COLUMN push_tokens.platform IS 'Device platform: ios, android, or web';
