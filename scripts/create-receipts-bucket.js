/**
 * Create the 'receipts' storage bucket in Supabase
 *
 * Storage buckets can't be created via SQL migrations on hosted Supabase.
 * This script uses the Storage API to create and configure the bucket.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/create-receipts-bucket.js
 *
 * Or for staging:
 *   SUPABASE_URL=https://odjvwviokthebfkbqgnx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/create-receipts-bucket.js
 *
 * Or for production:
 *   SUPABASE_URL=https://rzwuknfycyqitcbotsvx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/create-receipts-bucket.js
 */

const { createClient } = require('@supabase/supabase-js');

const BUCKET_NAME = 'receipts';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

async function createReceiptsBucket() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('Error: SUPABASE_URL environment variable is required');
    console.error('Example: SUPABASE_URL=https://xxx.supabase.co');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('Get it from: Supabase Dashboard > Project Settings > API > service_role key');
    process.exit(1);
  }

  console.log(`Connecting to: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if bucket already exists
  console.log(`Checking if '${BUCKET_NAME}' bucket exists...`);
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(BUCKET_NAME);

  if (existingBucket) {
    console.log(`Bucket '${BUCKET_NAME}' already exists!`);
    console.log('Bucket config:', JSON.stringify(existingBucket, null, 2));

    // Update bucket settings to ensure they're correct
    console.log('Updating bucket settings...');
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (updateError) {
      console.error('Error updating bucket:', updateError.message);
      process.exit(1);
    }

    console.log('Bucket settings updated successfully!');
    return;
  }

  if (getBucketError && !getBucketError.message.includes('not found')) {
    console.error('Error checking bucket:', getBucketError.message);
    process.exit(1);
  }

  // Create the bucket
  console.log(`Creating '${BUCKET_NAME}' bucket...`);
  const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });

  if (createError) {
    console.error('Error creating bucket:', createError.message);
    process.exit(1);
  }

  console.log(`Bucket '${BUCKET_NAME}' created successfully!`);
  console.log('Configuration:');
  console.log(`  - Public: true`);
  console.log(`  - Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  console.log(`  - Allowed MIME types: ${ALLOWED_MIME_TYPES.join(', ')}`);

  // Verify bucket was created
  const { data: verifyBucket } = await supabase.storage.getBucket(BUCKET_NAME);
  if (verifyBucket) {
    console.log('\nBucket verified:', JSON.stringify(verifyBucket, null, 2));
  }
}

createReceiptsBucket().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
