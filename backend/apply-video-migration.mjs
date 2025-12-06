import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationPath = path.resolve(__dirname, 'src/database/migrations/007_create_videos_table.sql');
console.log(`Reading migration file from: ${migrationPath}`);

try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('Running video table migration...\n');

    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } else {
        console.log('✅ Migration completed successfully!');
        console.log('Created table: videos');
        process.exit(0);
    }
} catch (err) {
    console.error('Error reading migration file:', err);
    process.exit(1);
}
