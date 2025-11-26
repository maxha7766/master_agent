/**
 * Check recent messages for image data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking recent messages with images...\n');

try {
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, image_url, image_metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('❌ ERROR:', error.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} recent messages:\n`);

  for (const msg of data) {
    console.log(`Message ID: ${msg.id}`);
    console.log(`Content: ${msg.content.substring(0, 50)}...`);
    console.log(`Has image URL: ${!!msg.image_url ? '✅ YES' : '❌ NO'}`);
    if (msg.image_url) {
      console.log(`Image URL: ${msg.image_url}`);
    }
    console.log(`Has metadata: ${!!msg.image_metadata ? '✅ YES' : '❌ NO'}`);
    if (msg.image_metadata) {
      console.log(`Metadata:`, JSON.stringify(msg.image_metadata, null, 2));
    }
    console.log(`Created: ${msg.created_at}`);
    console.log('---');
  }
} catch (err) {
  console.log('❌ ERROR:', err.message);
  process.exit(1);
}
