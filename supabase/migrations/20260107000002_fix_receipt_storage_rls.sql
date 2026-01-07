-- Fix receipt storage RLS policies
-- Remove overly permissive policies and add proper access control

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;

-- Authenticated users can view receipts (not public)
CREATE POLICY "Authenticated users can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Users can only delete their own uploaded receipts
-- Note: This requires tracking the uploader, for now restrict to authenticated
CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');
