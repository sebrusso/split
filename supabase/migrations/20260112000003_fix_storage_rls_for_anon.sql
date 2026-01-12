-- Fix storage RLS policies to work with anon key
-- The app uses Clerk for auth (not Supabase Auth), so users connect with anon role

-- Drop existing upload policy that requires authenticated role
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;

-- Allow anon role to upload to receipts bucket
-- Application-level checks handle authorization via clerk_user_id
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'receipts');

-- Also fix the view policy to allow anon
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;

CREATE POLICY "Users can view receipts"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'receipts');

-- Fix delete policy to allow anon
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

CREATE POLICY "Users can delete receipts"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'receipts');
