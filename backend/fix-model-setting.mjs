/**
 * Fix: Update user's default chat model to Claude Sonnet 4.5
 * This will enable the v2.0 executive assistant personality
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('🔍 Checking current model setting for user:', userId);
console.log('');

// First, check current setting
const { data: currentSettings, error: checkError } = await supabase
  .from('user_settings')
  .select('default_chat_model')
  .eq('user_id', userId)
  .single();

if (checkError) {
  console.error('❌ Error checking settings:', checkError);
  process.exit(1);
}

console.log('Current Model:', currentSettings?.default_chat_model || 'NULL (using system default)');
console.log('');

// Update to Claude Sonnet 4.5
console.log('📝 Updating to Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)...');
console.log('This model has the v2.0 executive assistant personality you built.');
console.log('');

const { data, error } = await supabase
  .from('user_settings')
  .update({ default_chat_model: 'claude-sonnet-4-5-20250929' })
  .eq('user_id', userId)
  .select();

if (error) {
  console.error('❌ Error updating settings:', error);
  process.exit(1);
}

console.log('✅ Successfully updated default model!');
console.log('');
console.log('Updated Settings:');
console.log(JSON.stringify(data, null, 2));
console.log('');
console.log('🎯 Expected Behavior Now:');
console.log('  - Brief, direct responses (no menu dumps)');
console.log('  - Executive assistant personality');
console.log('  - Mood-adaptive (Busy/Curious/Frustrated)');
console.log('  - Challenges vague requests');
console.log('  - Natural temporal awareness');
console.log('  - Stricter memory filtering (top 3, 0.82 threshold)');
console.log('');
console.log('Try saying "hi" again to see the difference!');

process.exit(0);
