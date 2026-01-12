-- Payment Events Table
-- Track payment interactions (Venmo payments, requests, etc.) for analytics and history

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('venmo', 'paypal', 'cashapp', 'zelle', 'cash', 'other')),
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_sent', 'payment_received', 'request_sent', 'request_received')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_events_receipt ON payment_events(receipt_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_group ON payment_events(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_from_member ON payment_events(from_member_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_to_member ON payment_events(to_member_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_method ON payment_events(payment_method);

-- Enable RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow authenticated users to manage their group's payment events)
CREATE POLICY "Users can view payment events in their groups"
  ON payment_events FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM members WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can insert payment events in their groups"
  ON payment_events FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM members WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Also allow anon access for MVP (matching other tables)
CREATE POLICY "Allow anon read access to payment_events"
  ON payment_events FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert access to payment_events"
  ON payment_events FOR INSERT TO anon WITH CHECK (true);

COMMENT ON TABLE payment_events IS 'Tracks payment interactions (Venmo, PayPal, etc.) for analytics and payment history';
COMMENT ON COLUMN payment_events.event_type IS 'Type of payment event: payment_sent (user sent money), request_sent (user requested money), etc.';
