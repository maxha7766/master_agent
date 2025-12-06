import { Client } from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
}

const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase usually
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database');

        const migrationPath = path.resolve(__dirname, 'src/database/migrations/007_create_videos_table.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        console.log('Running migration...');
        await client.query(migrationSQL);
        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
