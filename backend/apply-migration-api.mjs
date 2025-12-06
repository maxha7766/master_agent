import { readFileSync } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
    console.error('Missing SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN');
    process.exit(1);
}

const migrationPath = path.resolve(__dirname, 'src/database/migrations/007_create_videos_table.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

async function runMigration() {
    console.log('Running migration via Supabase Management API...');

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ Migration failed:', response.status, error);
        process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Migration completed successfully!');
    console.log('Result:', result);
}

runMigration();
