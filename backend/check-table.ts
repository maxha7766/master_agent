import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking if videos table exists...');
    const { data, error } = await supabase
        .from('videos')
        .select('count')
        .limit(1);

    if (error) {
        console.error('❌ Error accessing videos table:', error.message);
        if (error.code === '42P01') { // undefined_table
            console.log('Table does not exist.');
        }
        process.exit(1);
    } else {
        console.log('✅ Videos table exists and is accessible.');
        process.exit(0);
    }
}

checkTable();
