const { Client } = require('pg');

// Using direct connection to production (need the right password)
// Check Settings -> Database -> Connection String in Supabase Dashboard
const client = new Client({
  host: 'db.rzwuknfycyqitcbotsvx.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.PROD_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function getSchema() {
  try {
    await client.connect();
    console.log('Connected to production database');
    
    // Get table creation statements
    const result = await client.query(`
      SELECT 
        'CREATE TABLE IF NOT EXISTS ' || tablename || ' ();' as create_stmt
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log('Tables:', result.rows.length);
    result.rows.forEach(r => console.log(r.create_stmt));
    
  } catch (err) {
    console.error('Error:', err.message);
    console.log('Need to get the production DB password from Supabase Dashboard');
  } finally {
    await client.end();
  }
}

getSchema();
