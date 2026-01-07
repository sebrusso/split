-- Add method and notes columns to settlements table
-- Phase 2B P0: Settlement Enhancement features

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'method') THEN
    ALTER TABLE settlements ADD COLUMN method TEXT DEFAULT 'cash';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settlements' AND column_name = 'notes') THEN
    ALTER TABLE settlements ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add check constraint for valid settlement methods
DO $$
BEGIN
  ALTER TABLE settlements
  ADD CONSTRAINT valid_settlement_method CHECK (
    method IN ('cash', 'venmo', 'paypal', 'bank_transfer', 'zelle', 'other')
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_settlements_method ON settlements(method);
CREATE INDEX IF NOT EXISTS idx_settlements_group_settled ON settlements(group_id, settled_at DESC);

COMMENT ON COLUMN settlements.method IS 'Payment method used for settlement (cash, venmo, paypal, bank_transfer, zelle, other)';
COMMENT ON COLUMN settlements.notes IS 'Optional notes about the settlement (e.g., transaction ID, memo)';
