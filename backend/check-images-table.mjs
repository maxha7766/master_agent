/**
 * Check if images table exists
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking if images table exists...\n');

try {
  // Try to query the images table
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ ERROR: images table does not exist or is not accessible');
    console.log('Error:', error.message);
    console.log('\n📋 You need to run the migration: backend/src/database/migrations/005_create_images_table.sql');
    process.exit(1);
  }

  console.log('✅ SUCCESS: images table exists and is accessible');
  console.log(`Found ${data.length} images in the table`);
} catch (err) {
  console.log('❌ ERROR:', err.message);
  process.exit(1);
}
