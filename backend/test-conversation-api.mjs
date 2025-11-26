/**
 * Test the conversation API to verify camelCase transformation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import the getConversation function
import { getConversation } from './src/services/conversation/conversationService.js';

console.log('Testing conversation API transformation...\n');

try {
  // First, find a message with image to get its conversation ID
  const { data: messageWithImage, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id')
    .not('image_url', 'is', null)
    .limit(1)
    .single();

  if (msgError || !messageWithImage) {
    console.log('❌ No messages with images found');
    process.exit(1);
  }

  const conversationId = messageWithImage.conversation_id;
  console.log('Testing conversation:', conversationId);

  // Get user_id for this conversation
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  // Now test the getConversation function
  console.log('\n=== Testing getConversation() function ===\n');
  const conversation = await getConversation(conversationId, conv.user_id);

  // Find message with image
  const msgWithImg = conversation.messages.find(m => m.imageUrl || m.image_url);

  if (msgWithImg) {
    console.log('✅ SUCCESS: Message found with image');
    console.log('\nMessage fields:');
    console.log('- Has imageUrl (camelCase):', !!msgWithImg.imageUrl);
    console.log('- Has image_url (snake_case):', !!msgWithImg.image_url);
    console.log('- Has imageMetadata (camelCase):', !!msgWithImg.imageMetadata);
    console.log('- Has image_metadata (snake_case):', !!msgWithImg.image_metadata);

    if (msgWithImg.imageUrl && msgWithImg.imageMetadata) {
      console.log('\n🎉 TRANSFORMATION WORKING! Frontend will receive camelCase fields.');
      console.log('\nSample data:');
      console.log('imageUrl:', msgWithImg.imageUrl?.substring(0, 60) + '...');
      console.log('imageMetadata.operation:', msgWithImg.imageMetadata?.operationType || msgWithImg.imageMetadata?.operation_type);
    } else {
      console.log('\n❌ TRANSFORMATION FAILED! Missing camelCase fields.');
    }
  } else {
    console.log('❌ No message with image found in conversation');
  }

} catch (err) {
  console.log('❌ ERROR:', err.message);
  console.log(err);
  process.exit(1);
}
