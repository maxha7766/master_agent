/**
 * Test the actual getConversation transformation
 */

import { getConversation } from './dist/services/conversation/conversationService.js';

const conversationId = '056a29a6-a57f-4058-ae12-3de7565aa256';
const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('Testing getConversation API transformation...\n');
console.log('Conversation ID:', conversationId);
console.log('User ID:', userId);
console.log('\n');

try {
  const conversation = await getConversation(conversationId, userId);

  console.log('✅ Successfully loaded conversation');
  console.log(`Found ${conversation.messages.length} messages\n`);

  // Find message with image
  const msgWithImage = conversation.messages.find(m => m.image_url || m.imageUrl);

  if (!msgWithImage) {
    console.log('❌ NO MESSAGE WITH IMAGE FOUND');
    process.exit(1);
  }

  console.log('=== MESSAGE WITH IMAGE ===');
  console.log('Message ID:', msgWithImage.id);
  console.log('\nField inspection:');
  console.log('- Has image_url (snake_case):', !!msgWithImage.image_url);
  console.log('- Has imageUrl (camelCase):', !!msgWithImage.imageUrl);
  console.log('- Has image_metadata (snake_case):', !!msgWithImage.image_metadata);
  console.log('- Has imageMetadata (camelCase):', !!msgWithImage.imageMetadata);

  if (msgWithImage.imageUrl && msgWithImage.imageMetadata) {
    console.log('\n✅ ✅ ✅ TRANSFORMATION WORKING!');
    console.log('\nFrontend will receive:');
    console.log('imageUrl:', msgWithImage.imageUrl.substring(0, 80) + '...');
    console.log('imageMetadata.operation:', msgWithImage.imageMetadata.operationType);
    console.log('imageMetadata.dimensions:', `${msgWithImage.imageMetadata.width}x${msgWithImage.imageMetadata.height}`);
  } else {
    console.log('\n❌ ❌ ❌ TRANSFORMATION FAILED!');
    console.log('Frontend will NOT see camelCase fields');
  }

} catch (error) {
  console.log('❌ ERROR:', error.message);
  console.log(error);
  process.exit(1);
}
