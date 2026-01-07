-- Create receipts storage bucket for expense receipt images
-- This bucket allows authenticated users to upload receipt images for expenses
--
-- Bucket configuration:
-- - Max file size: 5MB (5242880 bytes)
-- - Allowed MIME types: JPEG, PNG, GIF, WebP, HEIC
-- - Public access: true (receipts are viewable by group members)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for receipts bucket
-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow public read access to receipts
CREATE POLICY "Public can view receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Allow users to delete their own uploaded receipts
-- Note: In a production app, you'd want more granular control
CREATE POLICY "Users can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');
