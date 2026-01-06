-- Add method and notes columns to settlements table
-- Phase 2B P0: Settlement Enhancement features

ALTER TABLE settlements
ADD COLUMN method TEXT DEFAULT 'cash',
ADD COLUMN notes TEXT;

-- Add check constraint for valid settlement methods
ALTER TABLE settlements
ADD CONSTRAINT valid_settlement_method CHECK (
  method IN ('cash', 'venmo', 'paypal', 'bank_transfer', 'zelle', 'other')
);

-- Create index on method for filtering
CREATE INDEX idx_settlements_method ON settlements(method);

-- Create index on group_id and settled_at for efficient queries
CREATE INDEX idx_settlements_group_settled ON settlements(group_id, settled_at DESC);

COMMENT ON COLUMN settlements.method IS 'Payment method used for settlement (cash, venmo, paypal, bank_transfer, zelle, other)';
COMMENT ON COLUMN settlements.notes IS 'Optional notes about the settlement (e.g., transaction ID, memo)';
