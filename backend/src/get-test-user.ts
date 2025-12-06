import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function getTestUser() {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('Error listing users:', error);
        throw error;
    }

    if (users.users.length > 0) {
        return users.users[0].id;
    } else {
        throw new Error('No users found');
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    getTestUser().then(id => console.log('Valid User ID:', id));
}
