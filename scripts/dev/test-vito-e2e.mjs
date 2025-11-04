/**
 * End-to-end test for Vito/Godfather query with RAG-only mode
 * Tests the actual WebSocket API
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testE2E() {
  console.log('=== END-TO-END TEST: VITO QUERY WITH RAG-ONLY MODE ===\n');

  // Get user
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;
  const userEmail = users?.users?.[0]?.email;

  if (!userId) {
    console.log('No users found');
    return;
  }

  console.log('User:', userEmail);
  console.log('User ID:', userId);

  // Get or create a conversation
  let { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  let conversationId;

  if (!conversations || conversations.length === 0) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ user_id: userId })
      .select('id')
      .single();
    conversationId = newConv.id;
  } else {
    conversationId = conversations[0].id;
  }

  console.log('Conversation ID:', conversationId);

  // Sign in as the user to get a token
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password: 'test123', // Default test password
  });

  if (signInError || !signInData.session) {
    console.error('Failed to sign in:', signInError);
    console.log('Note: Make sure the test user password is "test123"');
    return;
  }

  const accessToken = signInData.session.access_token;
  console.log('Got access token');

  // Connect to WebSocket
  console.log('\n=== CONNECTING TO WEBSOCKET ===');
  const ws = new WebSocket(`ws://localhost:3001?token=${accessToken}`);

  return new Promise((resolve, reject) => {
    let responseChunks = [];
    let messageId = null;

    ws.on('open', () => {
      console.log('✅ WebSocket connected');

      // Send chat message with RAG-only mode enabled
      const message = {
        kind: 'chat',
        conversationId,
        content: 'tell me about Vito in the Godfather',
        settings: {
          ragOnlyMode: true,
          topK: 5,
          minRelevanceScore: 0.0,
        },
      };

      console.log('\n=== SENDING MESSAGE ===');
      console.log('Query:', message.content);
      console.log('Settings:', message.settings);

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.kind) {
          case 'stream_start':
            console.log('\n=== STREAM START ===');
            console.log('Agent:', msg.agent);
            console.log('Model:', msg.model);
            messageId = msg.messageId;
            break;

          case 'stream_chunk':
            responseChunks.push(msg.chunk);
            break;

          case 'stream_end':
            console.log('\n=== STREAM END ===');
            const fullResponse = responseChunks.join('');
            console.log('Response length:', fullResponse.length);
            console.log('\nFirst 500 chars:');
            console.log(fullResponse.substring(0, 500));

            // Check if response is about Vito
            const hasVito = fullResponse.toLowerCase().includes('vito');
            const hasGodfather = fullResponse.toLowerCase().includes('godfather');

            console.log('\n=== VALIDATION ===');
            console.log(`Contains "Vito": ${hasVito}`);
            console.log(`Contains "Godfather": ${hasGodfather}`);

            if (hasVito && fullResponse.length > 100) {
              console.log('\n✅ SUCCESS: Got a real response about Vito!');
            } else if (fullResponse.includes("don't have")) {
              console.log('\n❌ FAIL: Got "no information" response');
              console.log('Full response:', fullResponse);
            } else {
              console.log('\n⚠️  UNCLEAR: Response doesn\'t clearly mention Vito');
            }

            ws.close();
            resolve();
            break;

          case 'error':
            console.error('\n❌ ERROR:', msg);
            ws.close();
            reject(new Error(msg.message));
            break;
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.log('\nWebSocket closed');
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('\n⏱️  Timeout - closing connection');
        ws.close();
        resolve();
      }
    }, 30000);
  });
}

testE2E()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
