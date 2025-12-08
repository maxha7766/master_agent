const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string from user input (verified earlier)
const connectionString = 'postgresql://postgres.omjwoyyhpdawjxsbpamc:1000Beans100!@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

const migrationPath = path.resolve(__dirname, '../backend/src/database/migrations/008_cleanup_unused_tables.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

async function run() {
    console.log('🔌 Connecting to database...');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase direct connection
    });

    try {
        await client.connect();
        console.log('✅ Connected!');

        console.log('🚀 Executing migration 008...');
        await client.query(migrationSQL);

        console.log('✨ Migration 008 applied successfully!');
    } catch (err) {
        console.error('❌ Error executing migration:', err);
    } finally {
        await client.end();
    }
}

run();
