const { Client } = require('pg');

// Use the same credentials as apply-baseline.js
const client = new Client({
  host: 'db.odjvwviokthebfkbqgnx.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'WSCweDxNVeyBzTFyWUAQIcmrASUGpblf',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkPolicies() {
  try {
    await client.connect();
    console.log('Connected to STAGING database\n');

    // Query storage policies
    const result = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'storage'
      ORDER BY tablename, cmd
    `);

    console.log('=== STAGING STORAGE POLICIES ===\n');

    if (result.rows.length === 0) {
      console.log('⚠️  NO STORAGE POLICIES FOUND ON STAGING!');
      console.log('This explains why uploads fail.\n');
    } else {
      result.rows.forEach(row => {
        console.log(`[${row.tablename}] ${row.policyname}`);
        console.log(`  Permissive: ${row.permissive}`);
        console.log(`  Roles: ${row.roles}`);
        console.log(`  Command: ${row.cmd}`);
        if (row.qual) console.log(`  USING: ${row.qual}`);
        if (row.with_check) console.log(`  WITH CHECK: ${row.with_check}`);
        console.log('');
      });

      // Analyze INSERT policy specifically
      console.log('=== INSERT POLICY ANALYSIS ===\n');
      const insertPolicy = result.rows.find(r => r.cmd === 'INSERT' && r.tablename === 'objects');

      if (insertPolicy) {
        console.log('✅ INSERT policy exists:', insertPolicy.policyname);
        console.log('   Roles:', insertPolicy.roles);

        const hasAnon = insertPolicy.roles.includes('anon');
        console.log('   Has anon role:', hasAnon ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM');

        console.log('   WITH CHECK:', insertPolicy.with_check);
      } else {
        console.log('❌ NO INSERT POLICY ON storage.objects!');
        console.log('   This is why uploads fail with RLS error.');
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    await client.end();
  }
}

checkPolicies();
