/**
 * Test API response format for conversations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing API response format...\n');

try {
  // Find a message with image first
  const { data: messageWithImage, error: msgError1 } = await supabase
    .from('messages')
    .select('*')
    .not('image_url', 'is', null)
    .limit(1)
    .single();

  if (msgError1 || !messageWithImage) {
    console.log('❌ No messages with images found');
    process.exit(1);
  }

  console.log('Found message with image!');
  console.log('Conversation ID:', messageWithImage.conversation_id);

  // Get all messages from that conversation
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', messageWithImage.conversation_id)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.log('❌ Error fetching messages:', msgError.message);
    process.exit(1);
  }

  console.log(`\nFound ${messages.length} messages\n`);

  // Show first message with image
  const imgMessage = messages.find(m => m.image_url);

  if (imgMessage) {
    console.log('=== MESSAGE WITH IMAGE ===');
    console.log('Fields in database response:');
    console.log(JSON.stringify(imgMessage, null, 2));
  } else {
    console.log('No messages with images found');
  }

} catch (err) {
  console.log('❌ ERROR:', err.message);
  process.exit(1);
}
