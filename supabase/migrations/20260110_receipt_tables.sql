-- Receipt Scanning Tables Migration
-- Adds support for receipt upload, OCR processing, and item claiming

-- ============================================
-- RECEIPTS TABLE
-- Stores uploaded receipt images and OCR results
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Original image
  image_url TEXT NOT NULL,
  image_thumbnail_url TEXT,

  -- OCR results
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_provider TEXT CHECK (ocr_provider IN ('google_vision', 'claude', 'gpt4v', 'textract')),
  ocr_raw_response JSONB,
  ocr_confidence DECIMAL(3,2) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),

  -- Extracted metadata
  merchant_name TEXT,
  merchant_address TEXT,
  receipt_date DATE,
  subtotal DECIMAL(10,2) CHECK (subtotal >= 0),
  tax_amount DECIMAL(10,2) CHECK (tax_amount >= 0),
  tip_amount DECIMAL(10,2) CHECK (tip_amount >= 0),
  total_amount DECIMAL(10,2) CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Status and sharing
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'claiming', 'settled', 'archived')),
  claim_deadline TIMESTAMPTZ,
  share_code TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for receipts
CREATE INDEX idx_receipts_group_id ON receipts(group_id);
CREATE INDEX idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_share_code ON receipts(share_code) WHERE share_code IS NOT NULL;
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);

-- ============================================
-- RECEIPT ITEMS TABLE
-- Individual line items extracted from receipt
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,

  -- Item details
  description TEXT NOT NULL CHECK (description <> ''),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),

  -- OCR metadata
  original_text TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  bounding_box JSONB,

  -- Ordering
  line_number INTEGER,

  -- Flags for special items (tax, tip, etc.)
  is_tax BOOLEAN NOT NULL DEFAULT FALSE,
  is_tip BOOLEAN NOT NULL DEFAULT FALSE,
  is_discount BOOLEAN NOT NULL DEFAULT FALSE,
  is_subtotal BOOLEAN NOT NULL DEFAULT FALSE,
  is_total BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for receipt_items
CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_line_number ON receipt_items(receipt_id, line_number);

-- ============================================
-- ITEM CLAIMS TABLE
-- Tracks which members claimed which items
-- ============================================
CREATE TABLE IF NOT EXISTS item_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_item_id UUID NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Claim details
  claim_type TEXT NOT NULL DEFAULT 'full' CHECK (claim_type IN ('full', 'split', 'partial')),
  share_fraction DECIMAL(5,4) NOT NULL DEFAULT 1.0 CHECK (share_fraction > 0 AND share_fraction <= 1),
  share_amount DECIMAL(10,2),
  split_count INTEGER NOT NULL DEFAULT 1 CHECK (split_count >= 1),

  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_via TEXT NOT NULL DEFAULT 'app' CHECK (claimed_via IN ('app', 'imessage', 'web', 'assigned')),

  -- Ensure unique claim per member per item
  UNIQUE(receipt_item_id, member_id)
);

-- Indexes for item_claims
CREATE INDEX idx_item_claims_receipt_item_id ON item_claims(receipt_item_id);
CREATE INDEX idx_item_claims_member_id ON item_claims(member_id);
CREATE INDEX idx_item_claims_claimed_at ON item_claims(claimed_at DESC);

-- ============================================
-- RECEIPT MEMBER TOTALS TABLE
-- Cached totals per member for quick access
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_member_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Calculated totals
  items_total DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (items_total >= 0),
  tax_share DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tax_share >= 0),
  tip_share DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tip_share >= 0),
  grand_total DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),

  -- Settlement tracking
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique total per member per receipt
  UNIQUE(receipt_id, member_id)
);

-- Indexes for receipt_member_totals
CREATE INDEX idx_receipt_member_totals_receipt_id ON receipt_member_totals(receipt_id);
CREATE INDEX idx_receipt_member_totals_member_id ON receipt_member_totals(member_id);
CREATE INDEX idx_receipt_member_totals_settled ON receipt_member_totals(is_settled) WHERE is_settled = FALSE;

-- ============================================
-- TRIGGER: Update receipts.updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_receipt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipt_timestamp
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_timestamp();

-- ============================================
-- TRIGGER: Update receipt_member_totals.updated_at
-- ============================================
CREATE TRIGGER trigger_update_receipt_member_totals_timestamp
  BEFORE UPDATE ON receipt_member_totals
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_timestamp();

-- ============================================
-- FUNCTION: Calculate member total for a receipt
-- ============================================
CREATE OR REPLACE FUNCTION calculate_receipt_member_total(
  p_receipt_id UUID,
  p_member_id UUID
)
RETURNS TABLE (
  items_total DECIMAL(10,2),
  tax_share DECIMAL(10,2),
  tip_share DECIMAL(10,2),
  grand_total DECIMAL(10,2)
) AS $$
DECLARE
  v_receipt receipts%ROWTYPE;
  v_claimed_subtotal DECIMAL(10,2);
  v_member_items_total DECIMAL(10,2);
  v_proportion DECIMAL(10,6);
BEGIN
  -- Get receipt info
  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id;

  -- Calculate member's items total
  SELECT COALESCE(SUM(ri.total_price * ic.share_fraction), 0)
  INTO v_member_items_total
  FROM item_claims ic
  JOIN receipt_items ri ON ri.id = ic.receipt_item_id
  WHERE ri.receipt_id = p_receipt_id
    AND ic.member_id = p_member_id
    AND NOT ri.is_tax
    AND NOT ri.is_tip
    AND NOT ri.is_subtotal
    AND NOT ri.is_total;

  -- Calculate total claimed subtotal (for proportion)
  SELECT COALESCE(SUM(ri.total_price * ic.share_fraction), 0)
  INTO v_claimed_subtotal
  FROM item_claims ic
  JOIN receipt_items ri ON ri.id = ic.receipt_item_id
  WHERE ri.receipt_id = p_receipt_id
    AND NOT ri.is_tax
    AND NOT ri.is_tip
    AND NOT ri.is_subtotal
    AND NOT ri.is_total;

  -- Calculate proportion for tax/tip distribution
  IF v_claimed_subtotal > 0 THEN
    v_proportion := v_member_items_total / v_claimed_subtotal;
  ELSE
    v_proportion := 0;
  END IF;

  -- Return calculated values
  RETURN QUERY SELECT
    ROUND(v_member_items_total, 2),
    ROUND(COALESCE(v_receipt.tax_amount, 0) * v_proportion, 2),
    ROUND(COALESCE(v_receipt.tip_amount, 0) * v_proportion, 2),
    ROUND(v_member_items_total + COALESCE(v_receipt.tax_amount, 0) * v_proportion + COALESCE(v_receipt.tip_amount, 0) * v_proportion, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update all member totals for a receipt
-- ============================================
CREATE OR REPLACE FUNCTION update_receipt_member_totals(p_receipt_id UUID)
RETURNS VOID AS $$
DECLARE
  v_member RECORD;
  v_totals RECORD;
BEGIN
  -- Get all members who have claims on this receipt
  FOR v_member IN
    SELECT DISTINCT ic.member_id
    FROM item_claims ic
    JOIN receipt_items ri ON ri.id = ic.receipt_item_id
    WHERE ri.receipt_id = p_receipt_id
  LOOP
    -- Calculate totals for this member
    SELECT * INTO v_totals FROM calculate_receipt_member_total(p_receipt_id, v_member.member_id);

    -- Upsert the totals
    INSERT INTO receipt_member_totals (receipt_id, member_id, items_total, tax_share, tip_share, grand_total)
    VALUES (p_receipt_id, v_member.member_id, v_totals.items_total, v_totals.tax_share, v_totals.tip_share, v_totals.grand_total)
    ON CONFLICT (receipt_id, member_id)
    DO UPDATE SET
      items_total = v_totals.items_total,
      tax_share = v_totals.tax_share,
      tip_share = v_totals.tip_share,
      grand_total = v_totals.grand_total,
      updated_at = NOW();
  END LOOP;

  -- Remove totals for members who no longer have claims
  DELETE FROM receipt_member_totals rmt
  WHERE rmt.receipt_id = p_receipt_id
    AND NOT EXISTS (
      SELECT 1 FROM item_claims ic
      JOIN receipt_items ri ON ri.id = ic.receipt_item_id
      WHERE ri.receipt_id = p_receipt_id AND ic.member_id = rmt.member_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-update totals when claims change
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_receipt_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_receipt_id UUID;
BEGIN
  -- Get receipt_id from the affected item
  IF TG_OP = 'DELETE' THEN
    SELECT ri.receipt_id INTO v_receipt_id
    FROM receipt_items ri
    WHERE ri.id = OLD.receipt_item_id;
  ELSE
    SELECT ri.receipt_id INTO v_receipt_id
    FROM receipt_items ri
    WHERE ri.id = NEW.receipt_item_id;
  END IF;

  -- Update all member totals for this receipt
  PERFORM update_receipt_member_totals(v_receipt_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_item_claims_update_totals
  AFTER INSERT OR UPDATE OR DELETE ON item_claims
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_receipt_totals();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_member_totals ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP (same as other tables)
-- TODO: Implement proper auth-based policies

CREATE POLICY "Allow all operations on receipts" ON receipts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on receipt_items" ON receipt_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on item_claims" ON item_claims
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on receipt_member_totals" ON receipt_member_totals
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE receipts IS 'Stores receipt images and OCR extraction results';
COMMENT ON TABLE receipt_items IS 'Individual line items extracted from receipts';
COMMENT ON TABLE item_claims IS 'Tracks which members claimed which receipt items';
COMMENT ON TABLE receipt_member_totals IS 'Cached per-member totals including tax/tip shares';

COMMENT ON COLUMN receipts.ocr_status IS 'Processing status: pending, processing, completed, failed';
COMMENT ON COLUMN receipts.status IS 'Overall receipt status: draft, processing, claiming, settled, archived';
COMMENT ON COLUMN receipts.share_code IS 'Unique code for web-based claiming link';

COMMENT ON COLUMN item_claims.share_fraction IS 'Fraction of item claimed (0.5 = half, 1.0 = full)';
COMMENT ON COLUMN item_claims.split_count IS 'Number of ways this item is split (for display purposes)';
COMMENT ON COLUMN item_claims.claimed_via IS 'Source of claim: app, imessage, web, or assigned by uploader';
