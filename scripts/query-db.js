const { Pool } = require('pg');

// Connection using individual parameters instead of URL to avoid escaping issues
const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.odjvwviokthebfkbqgnx',
  password: '9%D$i3kfeKyg5a!',
  ssl: { rejectUnauthorized: false }
});

async function query() {
  try {
    console.log('Connecting to staging database...\n');

    const result = await pool.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'storage'
      ORDER BY tablename, cmd
    `);

    console.log('=== STAGING STORAGE POLICIES ===\n');

    if (result.rows.length === 0) {
      console.log('⚠️  NO STORAGE POLICIES FOUND!');
      console.log('This explains why uploads fail - there are no RLS policies allowing access.');
    } else {
      result.rows.forEach(row => {
        console.log(`[${row.tablename}] ${row.policyname}`);
        console.log(`  Type: ${row.permissive}`);
        console.log(`  Roles: ${row.roles}`);
        console.log(`  Command: ${row.cmd}`);
        if (row.qual) console.log(`  USING: ${row.qual}`);
        if (row.with_check) console.log(`  WITH CHECK: ${row.with_check}`);
        console.log('');
      });

      // Specifically check for INSERT policy with anon role
      const insertPolicy = result.rows.find(r => r.cmd === 'INSERT' && r.tablename === 'objects');
      if (insertPolicy) {
        console.log('=== INSERT POLICY ANALYSIS ===');
        console.log('Policy name:', insertPolicy.policyname);
        console.log('Roles:', insertPolicy.roles);
        const hasAnon = insertPolicy.roles.includes('anon');
        console.log('Has anon role:', hasAnon ? '✅ YES' : '❌ NO');
        console.log('WITH CHECK:', insertPolicy.with_check);
      } else {
        console.log('❌ NO INSERT POLICY ON storage.objects!');
      }
    }
  } catch (err) {
    console.log('Connection error:', err.message);
    console.log('\nFull error:', err);
  } finally {
    await pool.end();
  }
}

query();
