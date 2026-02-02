const { Client } = require('pg');

const client = new Client({
  host: 'db.fvmaxcwfvhbmnffutgof.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'DDNxOCLHfdWIXgWdzQtRjzeAWCBGjewN',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    const result = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log('Tables in staging:', result.rows.map(r => r.tablename).join(', '));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
