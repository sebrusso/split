const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://odjvwviokthebfkbqgnx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTIxNTk0MCwiZXhwIjoyMDg0NzkxOTQwfQ.T5zzbdS3Slmr0Cqm8ZR40IzIKTvWn3xZnVFIFSrjCPs';

async function checkPolicies() {
  console.log('=== Checking Staging Storage Policies ===\n');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'public' }
  });

  // Try to query the database directly using a workaround
  // We'll test by trying to manually create a policy and catch the error

  // Method: Use the REST API to make direct SQL calls
  const testPolicySQL = `
    DO $$
    BEGIN
      -- Check if policy exists
      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Users can upload receipts'
      ) THEN
        RAISE NOTICE 'INSERT policy EXISTS';
      ELSE
        RAISE NOTICE 'INSERT policy MISSING';
      END IF;

      -- Check roles on that policy
      PERFORM policyname, roles
      FROM pg_policies
      WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload receipts';
    END $$;
  `;

  // Since we can't run arbitrary SQL easily, let's use a different approach:
  // Check the migration history

  console.log('Checking via Supabase management API...');

  // Try the DB URL approach using pg
  const pg = require('pg');

  // The connection string format for Supabase
  // postgres://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
  const connectionString = `postgresql://postgres.odjvwviokthebfkbqgnx:${process.env.DB_PASSWORD || 'PASSWORD_NEEDED'}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  console.log('\nNeed database password to query pg_policies directly.');
  console.log('You can find this in Supabase Dashboard > Project Settings > Database > Connection string');
  console.log('\nAlternatively, check the policies in the Supabase Dashboard:');
  console.log('1. Go to https://supabase.com/dashboard/project/odjvwviokthebfkbqgnx');
  console.log('2. Navigate to Storage > Policies');
  console.log('3. Look for "Users can upload receipts" policy on objects table');
  console.log('4. Verify it has "anon" in the roles list');

  // Alternative: Create a test function and call it
  console.log('\n=== Alternative: Testing upload path step by step ===\n');

  const testJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=', 'base64');

  // Test the exact upload path the app uses
  const testPath = 'receipts/test-group/test_file.jpg';

  console.log('Attempting upload to:', testPath);

  // Use service role to check if the path/bucket works at all
  const { data: adminUpload, error: adminErr } = await supabase.storage
    .from('receipts')
    .upload(testPath, testJpeg, { contentType: 'image/jpeg', upsert: true });

  if (adminErr) {
    console.log('Service role upload failed:', adminErr.message);
    console.log('This indicates a bucket configuration issue, not RLS');
  } else {
    console.log('Service role upload succeeded:', adminUpload.path);

    // Now try to download with anon key to verify SELECT works
    const anonClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMTU5NDAsImV4cCI6MjA4NDc5MTk0MH0.JDU6X8HZ3D9B3-9fuwx6dKspFD3eMfMnmkavb1difzY');

    const { data: files, error: listErr } = await anonClient.storage.from('receipts').list('receipts/test-group');
    console.log('Anon list files result:', listErr ? 'FAILED: ' + listErr.message : 'SUCCESS - ' + files.length + ' files');

    // Clean up
    await supabase.storage.from('receipts').remove([testPath]);
    console.log('Cleaned up test file');
  }

  console.log('\n=== Key Question ===');
  console.log('The INSERT policy should allow anon role to upload.');
  console.log('Check Supabase Dashboard > Storage > Policies to verify.');
}

checkPolicies().catch(console.error);
