import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFailedDocs() {
    const { data: documents } = await supabase
        .from('documents')
        .select('id, file_name, file_type, status, error_message, created_at')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5);

    if (documents && documents.length > 0) {
        documents.forEach(d => {
            console.log('FAILED DOCUMENT FOUND:');
            console.log(`File: ${d.file_name}`);
            console.log(`Error: ${d.error_message}`);
            console.log(`Time: ${d.created_at}`);
        })
    } else {
        console.log('No failed documents found in the last batch.');
    }
}

checkFailedDocs();
