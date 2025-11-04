import 'dotenv/config';
import WebSocket from 'ws';

const userId = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';
const conversationId = '9b59034b-b97a-4564-ac08-07dea578bf5c';
const token = process.env.SUPABASE_ANON_KEY; // Using anon key for testing

console.log('=== Testing Chat via WebSocket ===\n');
console.log('Connecting to ws://localhost:3001...');

const ws = new WebSocket('ws://localhost:3001', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

ws.on('open', () => {
  console.log('✅ WebSocket connected\n');

  // Send chat message
  const message = {
    kind: 'chat',
    conversationId,
    message: 'can i get the definition of a balk?',
  };

  console.log('📤 Sending message:', message.message);
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'stream_chunk' && message.content) {
    process.stdout.write(message.content);
  } else if (message.type === 'stream_end') {
    console.log('\n\n✅ Stream ended');
    console.log('\nMetadata:', JSON.stringify(message.metadata, null, 2));
    ws.close();
  } else if (message.type === 'error') {
    console.error('\n❌ Error:', message.error);
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket closed');
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout - closing connection');
  ws.close();
  process.exit(1);
}, 30000);
