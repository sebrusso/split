const { createClient } = require('@supabase/supabase-js');

// Staging credentials (same as Expo Go uses)
const SUPABASE_URL = 'https://odjvwviokthebfkbqgnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMTU5NDAsImV4cCI6MjA4NDc5MTk0MH0.JDU6X8HZ3D9B3-9fuwx6dKspFD3eMfMnmkavb1difzY';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTIxNTk0MCwiZXhwIjoyMDg0NzkxOTQwfQ.T5zzbdS3Slmr0Cqm8ZR40IzIKTvWn3xZnVFIFSrjCPs';

async function testUpload() {
  console.log('=== Testing Storage Upload ===\n');

  // Create a minimal valid JPEG (1x1 red pixel)
  const testJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=', 'base64');

  const timestamp = Date.now();
  const filePath = 'receipts/test/test_' + timestamp + '.jpg';

  // Test 1: Anon key upload
  console.log('1. Testing with ANON KEY...');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: data1, error: error1 } = await anonClient.storage
    .from('receipts')
    .upload(filePath, testJpeg, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error1) {
    console.log('   ❌ FAILED:', error1.message);
    console.log('   Status:', error1.statusCode || error1.status);
  } else {
    console.log('   ✅ SUCCESS:', data1.path);
    await anonClient.storage.from('receipts').remove([filePath]);
  }

  // Test 2: Service role upload
  console.log('\n2. Testing with SERVICE ROLE KEY...');
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const filePath2 = 'receipts/test/test_admin_' + timestamp + '.jpg';
  const { data: data2, error: error2 } = await adminClient.storage
    .from('receipts')
    .upload(filePath2, testJpeg, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error2) {
    console.log('   ❌ FAILED:', error2.message);
    console.log('   This means bucket/storage config issue, NOT RLS');
  } else {
    console.log('   ✅ SUCCESS:', data2.path);
    await adminClient.storage.from('receipts').remove([filePath2]);
  }

  // Test 3: Check what policies exist
  console.log('\n3. Checking RLS policies on storage.objects...');
  const { data: policies, error: policyErr } = await adminClient
    .rpc('get_policies_info')
    .catch(() => ({ data: null, error: 'RPC not available' }));

  if (policyErr || !policies) {
    // Query directly via SQL
    const query = `
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'storage'
      ORDER BY tablename, cmd
    `;
    console.log('   (Query policies via Supabase dashboard or MCP tool)');
  }

  // Test 4: Check JWT claims
  console.log('\n4. JWT Analysis:');
  const anonDecoded = JSON.parse(Buffer.from(SUPABASE_ANON_KEY.split('.')[1], 'base64').toString());
  console.log('   Anon key role:', anonDecoded.role);
  console.log('   Anon key iss:', anonDecoded.iss);
  console.log('   Anon key ref:', anonDecoded.ref);

  // Summary
  console.log('\n=== DIAGNOSIS ===');
  if (error1 && !error2) {
    console.log('RLS is blocking anon key uploads.');
    console.log('The policies may not include "anon" role, or there is a condition failing.');
  } else if (error1 && error2) {
    console.log('Both keys failed - this is NOT an RLS issue.');
    console.log('Check bucket configuration or storage service.');
  } else if (!error1) {
    console.log('Upload works! The issue may be app-specific (Clerk token, headers, etc.)');
  }
}

testUpload().catch(console.error);
