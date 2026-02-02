const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// New staging branch
const client = new Client({
  host: 'db.odjvwviokthebfkbqgnx.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'WSCweDxNVeyBzTFyWUAQIcmrASUGpblf',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected to staging database');
    
    // First check if tables exist
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    console.log('Existing tables:', tablesResult.rows.map(r => r.tablename).join(', ') || '(none)');
    
    if (tablesResult.rows.length === 0) {
      console.log('No tables exist - need to create schema first');
      return;
    }
    
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    console.log('Executing seed SQL...');
    
    await client.query(seedSQL);
    console.log('Seed completed successfully!');
    
    // Verify
    const result = await client.query('SELECT COUNT(*) as count FROM groups');
    console.log('Groups created:', result.rows[0].count);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

seed();
