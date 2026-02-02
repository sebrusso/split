-- Re-add missing storage.objects policies
-- These should have been created by 20260112000003 but are missing on staging
-- Using DROP IF EXISTS + CREATE to ensure clean state

-- First, drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;

-- INSERT policy for uploads
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'receipts');

-- SELECT policy for listing/downloading
CREATE POLICY "Users can view receipts"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'receipts');

-- DELETE policy
CREATE POLICY "Users can delete receipts"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'receipts');
