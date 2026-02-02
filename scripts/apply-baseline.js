const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'db.odjvwviokthebfkbqgnx.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'WSCweDxNVeyBzTFyWUAQIcmrASUGpblf',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function apply() {
  try {
    await client.connect();
    console.log('Connected to staging database');
    
    // Check what tables exist
    const tableCheck = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    console.log('Existing tables:', tableCheck.rows.map(r => r.tablename).join(', ') || '(none)');
    
    if (tableCheck.rows.length > 0) {
      console.log('Tables exist, skipping schema creation...');
    }
    
    // Apply seed data
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    console.log('Applying seed data...');
    
    await client.query(seedSQL);
    console.log('Seed data applied!');
    
    // Verify
    const groups = await client.query('SELECT COUNT(*) as count FROM groups');
    const members = await client.query('SELECT COUNT(*) as count FROM members');
    const expenses = await client.query('SELECT COUNT(*) as count FROM expenses');
    
    console.log('Results:');
    console.log('  Groups:', groups.rows[0].count);
    console.log('  Members:', members.rows[0].count);
    console.log('  Expenses:', expenses.rows[0].count);
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    await client.end();
  }
}

apply();
