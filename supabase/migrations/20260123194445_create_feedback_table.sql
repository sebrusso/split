-- Create feedback table for user feedback (feature requests, general feedback)
-- Bug reports are handled through Sentry's native feedback widget

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  user_email text,
  user_name text,
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  screen_name text,
  app_version text,
  device_info jsonb,
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'wont_fix')),
  created_at timestamptz DEFAULT now()
);

-- Create index for querying feedback by user
CREATE INDEX idx_feedback_clerk_user_id ON feedback(clerk_user_id);

-- Create index for querying by status
CREATE INDEX idx_feedback_status ON feedback(status);

-- Create index for querying by type
CREATE INDEX idx_feedback_type ON feedback(type);

-- Create index for sorting by date
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clerk_user_id = (auth.jwt() ->> 'sub')
  );

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT
  TO authenticated
  USING (
    clerk_user_id = (auth.jwt() ->> 'sub')
  );

-- Comment on table
COMMENT ON TABLE feedback IS 'User feedback submissions for feature requests and general feedback. Bug reports go through Sentry.';
