import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://postgres.omjwoyyhpdawjxsbpamc:1000BEANS1000!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function testConnection() {
    try {
        await client.connect();
        console.log('✅ Connected to database successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('Current time:', res.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
        process.exit(1);
    }
}

testConnection();
