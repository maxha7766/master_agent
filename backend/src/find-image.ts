
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findImages() {
    const { data, error } = await supabase
        .from('images')
        .select('*')
        .or('prompt.ilike.%cat%,prompt.ilike.%baseball%')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error finding images:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Found images:');
        data.forEach(img => {
            console.log(`- ID: ${img.id}`);
            console.log(`  Prompt: ${img.prompt}`);
            console.log(`  URL: ${img.storage_path}`); // Assuming storage_path or similar field stores the URL/path
            console.log(`  Created: ${img.created_at}`);
            console.log('---');
        });
    } else {
        console.log('No matching images found.');
    }
}

findImages();
