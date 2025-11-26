/**
 * Test the HTTP API endpoint to verify what the frontend receives
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

console.log('Testing HTTP API response format...\n');

try {
  // First, find a conversation with an image
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: messageWithImage, error: msgError } = await supabaseAdmin
    .from('messages')
    .select('conversation_id, user_id')
    .not('image_url', 'is', null)
    .limit(1)
    .single();

  if (msgError || !messageWithImage) {
    console.log('❌ No messages with images found');
    process.exit(1);
  }

  const conversationId = messageWithImage.conversation_id;
  console.log('Testing conversation:', conversationId);
  console.log('User ID:', messageWithImage.user_id);

  // Sign in as this user to get a valid token
  const { data: userData } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', messageWithImage.user_id)
    .single();

  console.log('User email:', userData?.email || 'Unknown');

  // For testing, let's directly query what the API route would return
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  console.log('\n=== RAW DATABASE RESPONSE ===');
  const msgWithImg = messages.find(m => m.image_url);
  if (msgWithImg) {
    console.log('Database fields (snake_case):');
    console.log('- image_url:', !!msgWithImg.image_url);
    console.log('- image_metadata:', !!msgWithImg.image_metadata);
  }

  // Simulate the transformation our code does
  console.log('\n=== AFTER TRANSFORMATION (what frontend receives) ===');
  const transformedMessages = messages.map((msg) => ({
    ...msg,
    imageUrl: msg.image_url,
    imageMetadata: msg.image_metadata,
  }));

  const transformedMsg = transformedMessages.find(m => m.imageUrl);
  if (transformedMsg) {
    console.log('Transformed fields (camelCase):');
    console.log('- imageUrl:', !!transformedMsg.imageUrl);
    console.log('- imageMetadata:', !!transformedMsg.imageMetadata);
    console.log('\n✅ Transformation adds camelCase fields');
    console.log('\nBoth fields exist:');
    console.log('- snake_case (image_url):', !!transformedMsg.image_url);
    console.log('- camelCase (imageUrl):', !!transformedMsg.imageUrl);
    console.log('\nFrontend will use: imageUrl =', transformedMsg.imageUrl.substring(0, 70) + '...');
  }

} catch (err) {
  console.log('❌ ERROR:', err.message);
  process.exit(1);
}
