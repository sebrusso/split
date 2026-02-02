-- Fix storage bucket and object RLS policies
-- The storage.buckets table needs a SELECT policy for uploads to work
-- The storage.objects table needs an UPDATE policy for file metadata updates

-- Allow users to see bucket metadata (required for uploads to work)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'buckets' 
    AND policyname = 'Allow public bucket access'
  ) THEN
    CREATE POLICY "Allow public bucket access"
    ON storage.buckets FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- Allow users to update receipt objects (needed for uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update receipts'
  ) THEN
    CREATE POLICY "Users can update receipts"
    ON storage.objects FOR UPDATE
    TO anon, authenticated
    USING (bucket_id = 'receipts')
    WITH CHECK (bucket_id = 'receipts');
  END IF;
END $$;
