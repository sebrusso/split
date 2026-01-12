-- Payment Reminders Tables
-- Enables smart payment reminder notifications

-- Create payment_reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed', 'paid')),
  frequency TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL, -- Clerk user ID
  note TEXT,

  -- Prevent reminding yourself
  CONSTRAINT different_members CHECK (from_member_id != to_member_id)
);

-- Create reminder_history table for tracking sent reminders
CREATE TABLE IF NOT EXISTS reminder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES payment_reminders(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'local', 'sms', 'email')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_reminders_group ON payment_reminders(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_from_member ON payment_reminders(from_member_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_to_member ON payment_reminders(to_member_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_scheduled ON payment_reminders(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_reminders_created_by ON payment_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_reminder_history_reminder ON reminder_history(reminder_id);

-- Enable RLS
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_reminders
-- Allow reading reminders for groups you're a member of
CREATE POLICY "Users can view reminders for their groups"
  ON payment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = payment_reminders.group_id
      AND members.clerk_user_id IS NOT NULL
    )
  );

-- Allow creating reminders for groups you're a member of
CREATE POLICY "Users can create reminders for their groups"
  ON payment_reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = payment_reminders.group_id
      AND members.clerk_user_id IS NOT NULL
    )
  );

-- Allow updating your own reminders or reminders where you're the debtor
CREATE POLICY "Users can update relevant reminders"
  ON payment_reminders FOR UPDATE
  USING (
    created_by IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM members
      WHERE members.id = payment_reminders.from_member_id
      AND members.clerk_user_id IS NOT NULL
    )
  );

-- Allow deleting your own reminders
CREATE POLICY "Users can delete their own reminders"
  ON payment_reminders FOR DELETE
  USING (created_by IS NOT NULL);

-- RLS Policies for reminder_history
CREATE POLICY "Users can view reminder history"
  ON reminder_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_reminders
      WHERE payment_reminders.id = reminder_history.reminder_id
    )
  );

CREATE POLICY "System can insert reminder history"
  ON reminder_history FOR INSERT
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE payment_reminders IS 'Smart payment reminders for outstanding balances';
COMMENT ON TABLE reminder_history IS 'History of sent reminders for tracking and analytics';
COMMENT ON COLUMN payment_reminders.frequency IS 'How often to send reminders: once, daily, or weekly';
COMMENT ON COLUMN payment_reminders.created_by IS 'Clerk user ID of who created the reminder';
