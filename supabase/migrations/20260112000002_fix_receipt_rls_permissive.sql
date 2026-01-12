-- Fix RLS policies for receipts to use permissive policies
-- This replaces the restrictive policies that were incompatible with Clerk auth

-- Drop existing restrictive policies (if they exist)
DROP POLICY IF EXISTS "Authenticated users can create receipts" ON receipts;
DROP POLICY IF EXISTS "Users can read their receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update their receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete their receipts" ON receipts;
DROP POLICY IF EXISTS "Users can manage receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Users can manage item claims" ON item_claims;
DROP POLICY IF EXISTS "Users can manage receipt member totals" ON receipt_member_totals;

-- Also drop any "Allow all" policies that might still exist
DROP POLICY IF EXISTS "Allow all operations on receipts" ON receipts;
DROP POLICY IF EXISTS "Allow all operations on receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow all operations on item_claims" ON item_claims;
DROP POLICY IF EXISTS "Allow all operations on receipt_member_totals" ON receipt_member_totals;

-- Create permissive policies that work with Clerk auth
-- Application-level checks handle authorization via clerk_user_id
CREATE POLICY "Allow authenticated receipt operations"
ON receipts FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated receipt item operations"
ON receipt_items FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated item claim operations"
ON item_claims FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated receipt total operations"
ON receipt_member_totals FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
