/**
 * Verify messages table has image columns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Verifying messages table schema...\n');

try {
  // Try to query with image fields
  const { data, error } = await supabase
    .from('messages')
    .select('id, image_url, image_metadata')
    .limit(1);

  if (error) {
    console.log('❌ ERROR: Columns not accessible');
    console.log('Error:', error.message);
    process.exit(1);
  }

  console.log('✅ SUCCESS: Messages table has image columns!');
  console.log('Sample query returned:', data.length, 'rows');

  if (data.length > 0 && data[0].image_url) {
    console.log('\nFound message with image:');
    console.log('  - Image URL:', data[0].image_url);
    console.log('  - Has metadata:', !!data[0].image_metadata);
  }

  console.log('\n🎉 Image generation feature is ready to use!');
} catch (err) {
  console.log('❌ ERROR:', err.message);
  process.exit(1);
}
