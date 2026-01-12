-- Settlement Links Table
-- Enables shareable URLs for group settlements

-- Create settlement_links table
CREATE TABLE IF NOT EXISTS settlement_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  share_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  settlement_data JSONB NOT NULL, -- JSON array of settlement items
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_share_code CHECK (share_code ~ '^[A-Z0-9]{8}$'),
  CONSTRAINT valid_settlement_data CHECK (jsonb_typeof(settlement_data) = 'array')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlement_links_group ON settlement_links(group_id);
CREATE INDEX IF NOT EXISTS idx_settlement_links_share_code ON settlement_links(share_code);
CREATE INDEX IF NOT EXISTS idx_settlement_links_expires ON settlement_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_settlement_links_created_by ON settlement_links(created_by);

-- Enable RLS
ALTER TABLE settlement_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read settlement links by share code (for sharing)
CREATE POLICY "Anyone can view settlement links by share code"
  ON settlement_links FOR SELECT
  USING (true);

-- Users can create settlement links for groups they're members of
CREATE POLICY "Users can create settlement links for their groups"
  ON settlement_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = settlement_links.group_id
      AND members.clerk_user_id IS NOT NULL
    )
  );

-- Users can update links they created (e.g., increment access count)
CREATE POLICY "Users can update their settlement links"
  ON settlement_links FOR UPDATE
  USING (true);

-- Users can delete links they created
CREATE POLICY "Users can delete their settlement links"
  ON settlement_links FOR DELETE
  USING (created_by IS NOT NULL);

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_settlement_link_access(link_share_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE settlement_links
  SET
    accessed_count = accessed_count + 1,
    last_accessed_at = NOW()
  WHERE share_code = link_share_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired links (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_settlement_links()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM settlement_links
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE settlement_links IS 'Shareable URLs for group settlements with payment buttons';
COMMENT ON COLUMN settlement_links.share_code IS 'Unique 8-character code for sharing';
COMMENT ON COLUMN settlement_links.settlement_data IS 'JSON array of settlement items with payment links';
COMMENT ON COLUMN settlement_links.accessed_count IS 'Number of times the link has been accessed';
