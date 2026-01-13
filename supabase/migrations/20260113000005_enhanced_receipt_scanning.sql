-- Enhanced Receipt Scanning Migration
-- Adds support for:
-- 1. Multi-quantity item expansion
-- 2. Shared item detection
-- 3. Modifier/add-on grouping
-- 4. Service charge detection
-- 5. Discount attribution

-- ============================================
-- RECEIPT_ITEMS TABLE ENHANCEMENTS
-- ============================================

-- Multi-quantity expansion fields
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS original_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS expanded_from_id uuid REFERENCES receipt_items(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_expansion boolean DEFAULT false;

-- Shared item detection
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS is_likely_shared boolean DEFAULT false;

-- Modifier/add-on grouping
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS is_modifier boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES receipt_items(id) ON DELETE CASCADE;

-- Service charge detection (separate from is_tax/is_tip)
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS is_service_charge boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS service_charge_type text; -- 'gratuity', 'delivery', 'convenience', 'other'

-- Discount tracking
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS applies_to_item_id uuid REFERENCES receipt_items(id) ON DELETE SET NULL;

-- ============================================
-- RECEIPTS TABLE ENHANCEMENTS
-- ============================================

-- Store structured discount info
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge_amount numeric(10,2) DEFAULT 0;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for finding expanded items from parent
CREATE INDEX IF NOT EXISTS idx_receipt_items_expanded_from
ON receipt_items(expanded_from_id)
WHERE expanded_from_id IS NOT NULL;

-- Index for finding modifiers of a parent item
CREATE INDEX IF NOT EXISTS idx_receipt_items_parent_item
ON receipt_items(parent_item_id)
WHERE parent_item_id IS NOT NULL;

-- Index for finding shared items
CREATE INDEX IF NOT EXISTS idx_receipt_items_shared
ON receipt_items(receipt_id, is_likely_shared)
WHERE is_likely_shared = true;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN receipt_items.original_quantity IS 'Original quantity before expansion (e.g., 3 for "3 x Burger")';
COMMENT ON COLUMN receipt_items.expanded_from_id IS 'Points to parent item when this is an expanded individual unit';
COMMENT ON COLUMN receipt_items.is_expansion IS 'True if this item was created by expanding a multi-quantity item';
COMMENT ON COLUMN receipt_items.is_likely_shared IS 'True if OCR detected this as a shared item (pitcher, appetizer, etc.)';
COMMENT ON COLUMN receipt_items.is_modifier IS 'True if this is an add-on/modifier (e.g., "+ Extra Cheese")';
COMMENT ON COLUMN receipt_items.parent_item_id IS 'Points to the main item this modifier belongs to';
COMMENT ON COLUMN receipt_items.is_service_charge IS 'True if this is a service charge (gratuity, delivery fee, etc.)';
COMMENT ON COLUMN receipt_items.service_charge_type IS 'Type of service charge: gratuity, delivery, convenience, other';
COMMENT ON COLUMN receipt_items.applies_to_item_id IS 'For discounts: which specific item this discount applies to';
COMMENT ON COLUMN receipts.discount_amount IS 'Total discount amount on the receipt';
COMMENT ON COLUMN receipts.service_charge_amount IS 'Total service charges (separate from tip)';
