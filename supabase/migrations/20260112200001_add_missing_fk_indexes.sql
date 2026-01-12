-- Add Missing Foreign Key Indexes
-- Purpose: Fix unindexed foreign key warnings from Supabase linter
-- These indexes improve JOIN performance and DELETE cascade operations

-- Index for receipt_member_totals.settlement_id
CREATE INDEX IF NOT EXISTS idx_receipt_member_totals_settlement_id
ON public.receipt_member_totals (settlement_id);

-- Index for recurring_expense_splits.member_id
CREATE INDEX IF NOT EXISTS idx_recurring_expense_splits_member_id
ON public.recurring_expense_splits (member_id);

-- Index for recurring_expenses.paid_by
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_paid_by
ON public.recurring_expenses (paid_by);
