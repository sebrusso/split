-- =============================================================================
-- BASELINE SCHEMA MIGRATION
-- =============================================================================
-- This migration creates the initial database schema for split it.
-- It must run before all other migrations.
-- Generated from production schema on 2026-01-24
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(name) <= 255),
    emoji text DEFAULT '👥'::text,
    currency text DEFAULT 'USD'::text,
    share_code text NOT NULL UNIQUE CHECK (TRIM(BOTH FROM share_code) <> ''::text),
    created_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    pinned boolean DEFAULT false,
    notes text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Members table
CREATE TABLE IF NOT EXISTS public.members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) <= 255),
    user_id uuid,
    clerk_user_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    description text NOT NULL CHECK (length(description) <= 1000),
    amount numeric NOT NULL CHECK (amount > 0),
    paid_by uuid NOT NULL REFERENCES public.members(id),
    created_at timestamp with time zone DEFAULT now(),
    category text DEFAULT 'other'::text,
    expense_date date DEFAULT CURRENT_DATE,
    notes text CHECK (notes IS NULL OR length(notes) <= 2000),
    merchant text,
    receipt_url text,
    split_type text DEFAULT 'equal'::text,
    deleted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    currency text,
    exchange_rate numeric,
    exchange_rate_time timestamp with time zone
);

-- Splits table
CREATE TABLE IF NOT EXISTS public.splits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount >= 0),
    updated_at timestamp with time zone DEFAULT now()
);

-- Settlements table
CREATE TABLE IF NOT EXISTS public.settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    from_member_id uuid NOT NULL REFERENCES public.members(id),
    to_member_id uuid NOT NULL REFERENCES public.members(id),
    amount numeric NOT NULL CHECK (amount > 0),
    settled_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    notes text,
    method text DEFAULT 'other'::text CHECK (method = ANY (ARRAY['cash', 'venmo', 'paypal', 'bank_transfer', 'zelle', 'other'])),
    proof_url text,
    updated_at timestamp with time zone DEFAULT now()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id text NOT NULL UNIQUE,
    email text,
    display_name text,
    avatar_url text,
    default_currency text DEFAULT 'USD'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    venmo_username text,
    venmo_display_name text
);

-- Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id text NOT NULL,
    addressee_id text NOT NULL,
    status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending', 'accepted', 'blocked'])),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
    actor_id text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Push tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    token text NOT NULL UNIQUE,
    platform text NOT NULL CHECK (platform = ANY (ARRAY['ios', 'android', 'web'])),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Recurring expenses table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    description text NOT NULL CHECK (length(description) <= 1000),
    amount numeric NOT NULL CHECK (amount > 0),
    paid_by uuid NOT NULL REFERENCES public.members(id),
    category text DEFAULT 'other'::text,
    split_type text DEFAULT 'equal'::text,
    notes text CHECK (notes IS NULL OR length(notes) <= 2000),
    frequency text NOT NULL CHECK (frequency = ANY (ARRAY['daily', 'weekly', 'biweekly', 'monthly', 'yearly'])),
    day_of_week integer CHECK (day_of_week IS NULL OR day_of_week >= 0 AND day_of_week <= 6),
    day_of_month integer CHECK (day_of_month IS NULL OR day_of_month >= 1 AND day_of_month <= 31),
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    next_due_date date NOT NULL DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text
);

-- Recurring expense splits table
CREATE TABLE IF NOT EXISTS public.recurring_expense_splits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_expense_id uuid NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount numeric,
    percentage numeric,
    shares integer DEFAULT 1
);

-- Receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
    uploaded_by uuid REFERENCES public.members(id),
    image_url text NOT NULL,
    image_thumbnail_url text,
    ocr_status text NOT NULL DEFAULT 'pending'::text CHECK (ocr_status = ANY (ARRAY['pending', 'processing', 'completed', 'failed'])),
    ocr_provider text CHECK (ocr_provider = ANY (ARRAY['gemini', 'google_vision', 'claude', 'gpt4v', 'textract'])),
    ocr_raw_response jsonb,
    ocr_confidence numeric CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
    merchant_name text,
    merchant_address text,
    receipt_date date,
    subtotal numeric CHECK (subtotal >= 0),
    tax_amount numeric CHECK (tax_amount >= 0),
    tip_amount numeric CHECK (tip_amount >= 0),
    total_amount numeric CHECK (total_amount >= 0),
    currency text NOT NULL DEFAULT 'USD'::text,
    status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft', 'processing', 'claiming', 'settled', 'archived'])),
    claim_deadline timestamp with time zone,
    share_code text UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    uploaded_by_clerk_id text,
    discount_amount numeric DEFAULT 0,
    service_charge_amount numeric DEFAULT 0
);

-- Receipt items table
CREATE TABLE IF NOT EXISTS public.receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    description text NOT NULL CHECK (description <> ''),
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price numeric,
    total_price numeric NOT NULL CHECK (total_price >= 0),
    original_text text,
    confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
    bounding_box jsonb,
    line_number integer,
    is_tax boolean NOT NULL DEFAULT false,
    is_tip boolean NOT NULL DEFAULT false,
    is_discount boolean NOT NULL DEFAULT false,
    is_subtotal boolean NOT NULL DEFAULT false,
    is_total boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    is_likely_shared boolean DEFAULT false,
    original_quantity integer DEFAULT 1,
    expanded_from_id uuid REFERENCES public.receipt_items(id),
    is_expansion boolean DEFAULT false,
    is_modifier boolean DEFAULT false,
    parent_item_id uuid REFERENCES public.receipt_items(id),
    is_service_charge boolean DEFAULT false,
    service_charge_type text,
    applies_to_item_id uuid REFERENCES public.receipt_items(id)
);

-- Item claims table
CREATE TABLE IF NOT EXISTS public.item_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_item_id uuid NOT NULL REFERENCES public.receipt_items(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    claim_type text NOT NULL DEFAULT 'full'::text CHECK (claim_type = ANY (ARRAY['full', 'split', 'partial'])),
    share_fraction numeric NOT NULL DEFAULT 1.0 CHECK (share_fraction > 0 AND share_fraction <= 1),
    share_amount numeric,
    split_count integer NOT NULL DEFAULT 1 CHECK (split_count >= 1),
    claimed_at timestamp with time zone NOT NULL DEFAULT now(),
    claimed_via text NOT NULL DEFAULT 'app'::text CHECK (claimed_via = ANY (ARRAY['app', 'imessage', 'web', 'assigned']))
);

-- Receipt member totals table
CREATE TABLE IF NOT EXISTS public.receipt_member_totals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    items_total numeric NOT NULL DEFAULT 0 CHECK (items_total >= 0),
    tax_share numeric NOT NULL DEFAULT 0 CHECK (tax_share >= 0),
    tip_share numeric NOT NULL DEFAULT 0 CHECK (tip_share >= 0),
    grand_total numeric NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
    is_settled boolean NOT NULL DEFAULT false,
    settled_at timestamp with time zone,
    settlement_id uuid REFERENCES public.settlements(id),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Payment reminders table
CREATE TABLE IF NOT EXISTS public.payment_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    from_member_id uuid NOT NULL REFERENCES public.members(id),
    to_member_id uuid NOT NULL REFERENCES public.members(id),
    amount numeric NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending', 'sent', 'dismissed', 'paid'])),
    frequency text NOT NULL DEFAULT 'once'::text CHECK (frequency = ANY (ARRAY['once', 'daily', 'weekly'])),
    scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
    sent_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Reminder history table
CREATE TABLE IF NOT EXISTS public.reminder_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id uuid NOT NULL REFERENCES public.payment_reminders(id) ON DELETE CASCADE,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    channel text NOT NULL CHECK (channel = ANY (ARRAY['push', 'local', 'sms', 'email'])),
    success boolean NOT NULL DEFAULT false,
    error_message text
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_members_group_id ON public.members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_clerk_user_id ON public.members(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_splits_expense_id ON public.splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_member_id ON public.splits(member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_receipts_group_id ON public.receipts(group_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_receipt_item_id ON public.item_claims(receipt_item_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_member_id ON public.item_claims(member_id);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_member_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- BASIC RLS POLICIES (permissive for MVP)
-- =============================================================================

-- Groups policies
CREATE POLICY "Allow all operations on groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);

-- Members policies
CREATE POLICY "Allow all operations on members" ON public.members FOR ALL USING (true) WITH CHECK (true);

-- Expenses policies
CREATE POLICY "Allow all operations on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Splits policies
CREATE POLICY "Allow all operations on splits" ON public.splits FOR ALL USING (true) WITH CHECK (true);

-- Settlements policies
CREATE POLICY "Allow all operations on settlements" ON public.settlements FOR ALL USING (true) WITH CHECK (true);

-- User profiles policies
CREATE POLICY "Allow all operations on user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- Friendships policies
CREATE POLICY "Allow all operations on friendships" ON public.friendships FOR ALL USING (true) WITH CHECK (true);

-- Activity log policies
CREATE POLICY "Allow all operations on activity_log" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);

-- Push tokens policies
CREATE POLICY "Allow all operations on push_tokens" ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);

-- Recurring expenses policies
CREATE POLICY "Allow all operations on recurring_expenses" ON public.recurring_expenses FOR ALL USING (true) WITH CHECK (true);

-- Recurring expense splits policies
CREATE POLICY "Allow all operations on recurring_expense_splits" ON public.recurring_expense_splits FOR ALL USING (true) WITH CHECK (true);

-- Receipts policies
CREATE POLICY "Allow all operations on receipts" ON public.receipts FOR ALL USING (true) WITH CHECK (true);

-- Receipt items policies
CREATE POLICY "Allow all operations on receipt_items" ON public.receipt_items FOR ALL USING (true) WITH CHECK (true);

-- Item claims policies
CREATE POLICY "Allow all operations on item_claims" ON public.item_claims FOR ALL USING (true) WITH CHECK (true);

-- Receipt member totals policies
CREATE POLICY "Allow all operations on receipt_member_totals" ON public.receipt_member_totals FOR ALL USING (true) WITH CHECK (true);

-- Payment reminders policies
CREATE POLICY "Allow all operations on payment_reminders" ON public.payment_reminders FOR ALL USING (true) WITH CHECK (true);

-- Reminder history policies
CREATE POLICY "Allow all operations on reminder_history" ON public.reminder_history FOR ALL USING (true) WITH CHECK (true);
