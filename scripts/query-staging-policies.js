const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const SUPABASE_URL = 'https://odjvwviokthebfkbqgnx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTIxNTk0MCwiZXhwIjoyMDg0NzkxOTQwfQ.T5zzbdS3Slmr0Cqm8ZR40IzIKTvWn3xZnVFIFSrjCPs';

// Decode the JWT to get the ref
const decoded = JSON.parse(Buffer.from(SERVICE_KEY.split('.')[1], 'base64').toString());
console.log('Project ref from JWT:', decoded.ref);

async function queryPolicies() {
  console.log('=== Querying Staging Policies ===\n');

  // Try using the Supabase Data API with service role
  // The service role bypasses RLS but we still need access to system tables

  // Approach: Create a temporary function to query pg_policies
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Use raw SQL via supabase-js edge runtime (if available)
  // Or try the REST endpoint for functions

  // Actually, let's try a creative workaround:
  // Create a view that exposes pg_policies to the REST API

  console.log('Attempting to query storage policies...\n');

  // Try fetching the storage.objects table structure
  const { data: columns, error: colErr } = await supabase
    .from('information_schema.columns')
    .select('*')
    .eq('table_schema', 'storage')
    .eq('table_name', 'objects');

  if (colErr) {
    console.log('Cannot query information_schema:', colErr.message);
  }

  // Check if we can use the execute_sql edge function if it exists
  const { data: functions, error: funcErr } = await supabase
    .functions
    .invoke('execute_sql', {
      body: { query: "SELECT * FROM pg_policies WHERE schemaname = 'storage'" }
    });

  if (funcErr) {
    console.log('No execute_sql function available');
  } else if (functions) {
    console.log('Policies from function:', functions);
  }

  // Last resort: Check the _supabase_migrations schema
  console.log('\nChecking applied migrations...');

  // Query the schema_migrations table
  const { data: migrations, error: migErr } = await supabase
    .from('schema_migrations')
    .select('*')
    .order('version', { ascending: false })
    .limit(10);

  if (migErr) {
    console.log('Cannot query schema_migrations:', migErr.message);
  } else if (migrations) {
    console.log('Recent migrations:', migrations.map(m => m.version));
  }

  // Final approach: Use the database URL directly if provided
  const dbPassword = process.env.DB_PASSWORD;
  if (dbPassword) {
    console.log('\nConnecting with database password...');
    const pool = new Pool({
      connectionString: `postgresql://postgres.odjvwviokthebfkbqgnx:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const result = await pool.query(`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'storage'
        ORDER BY tablename, cmd
      `);
      console.log('\nStorage policies:');
      result.rows.forEach(row => {
        console.log(`  ${row.tablename}.${row.policyname}`);
        console.log(`    cmd: ${row.cmd}, roles: ${row.roles}`);
        console.log(`    qual: ${row.qual}`);
        console.log(`    with_check: ${row.with_check}`);
        console.log('');
      });
    } catch (err) {
      console.log('Database query failed:', err.message);
    } finally {
      await pool.end();
    }
  } else {
    console.log('\n⚠️  To query policies directly, set DB_PASSWORD environment variable');
    console.log('   Find it in: Supabase Dashboard > Project Settings > Database > Connection string\n');

    // Provide instructions for manual verification
    console.log('=== Manual Verification Steps ===');
    console.log('1. Go to: https://supabase.com/dashboard/project/odjvwviokthebfkbqgnx');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Run this query:');
    console.log(`
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, cmd;
    `);
    console.log('4. Verify that "Users can upload receipts" policy exists');
    console.log('5. Verify it has roles = {anon,authenticated}');
    console.log('6. Verify cmd = INSERT');
    console.log('7. Verify with_check = (bucket_id = \'receipts\'::text)');
  }
}

queryPolicies().catch(console.error);
