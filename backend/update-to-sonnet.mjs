import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://omjwoyyhpdawjxsbpamc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0'
);

// Your user ID from the logs
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('Updating default model to claude-sonnet-4-5-20250929 for user:', userId);

const { data, error } = await supabase
  .from('user_settings')
  .update({ default_chat_model: 'claude-sonnet-4-5-20250929' })
  .eq('user_id', userId)
  .select();

if (error) {
  console.error('Error updating settings:', error);
} else {
  console.log('\n✅ Successfully updated settings!');
  console.log(JSON.stringify(data, null, 2));
}

process.exit(0);
