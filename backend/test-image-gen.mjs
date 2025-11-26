/**
 * Test Image Generation via WebSocket
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImZaclA0QXlNZVd2dlJjTnIiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY0MTIxNDU0LCJpYXQiOjE3NjQxMTc4NTQsImlzcyI6Imh0dHBzOi8vYWJ2cHF6enRyY2J4d3RiZnNvcmwuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjhmNTJmMDViLTQ3ZTUtNDAxOC05OGMyLTY5ZThkYWY5ZTVjOSIsImVtYWlsIjoiaGVhdGgubWF4d2VsbEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6Imdvb2dsZSIsInByb3ZpZGVycyI6WyJnb29nbGUiXX0sInVzZXJfbWV0YWRhdGEiOnsiYXZhdGFyX3VybCI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0laU3ZHcm1LLWdWb1JMbEdJYzFjX2c1aUNISkc1SXpGLTlveXFfODRRLWxrRGJWdz1zOTYtYyIsImVtYWlsIjoiaGVhdGgubWF4d2VsbEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiSGVhdGggTWF4d2VsbCIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsIm5hbWUiOiJIZWF0aCBNYXh3ZWxsIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSVpTdkdybUstZ1ZvUkxsR0ljMWNfZzVpQ0hKRzVJekYtOW95cV84NFFfbGtEYlZ3PXM5Ni1jIiwicHJvdmlkZXJfaWQiOiIxMDI3NTg4MjYwNDk5NDA2MzA5OTUiLCJzdWIiOiIxMDI3NTg4MjYwNDk5NDA2MzA5OTUifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvYXV0aCIsInRpbWVzdGFtcCI6MTc2NDExNzg1NH1dLCJzZXNzaW9uX2lkIjoiOTI2ODI5ZmMtOGNlOS00N2FhLWJjZWQtMGIwY2U4NGMwOTUzIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.aYh9AhZp6zHd5-5U3pOb0tBOvYd5KhU7XRqLhJh8XCo';

async function testImageGeneration() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to WebSocket...');
    const ws = new WebSocket(WS_URL, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    });

    ws.on('open', () => {
      console.log('✅ Connected to WebSocket');

      // Send image generation request
      const request = {
        kind: 'image_generate',
        operation: 'text-to-image',
        parameters: {
          prompt: 'A beautiful sunset over mountains with vivid orange and purple colors',
          size: 'square',
          creativityMode: 'balanced',
        },
      };

      console.log('📤 Sending image generation request:', JSON.stringify(request, null, 2));
      ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message.kind);

        switch (message.kind) {
          case 'connection':
            console.log('  Connection status:', message.status);
            break;

          case 'progress':
            console.log(`  Progress: ${message.progressPercent}% - ${message.status}`);
            break;

          case 'image_result':
            console.log('✅ Image generation complete!');
            console.log('  Job ID:', message.jobId);
            console.log('  Image URL:', message.data?.generatedImageUrl || 'N/A');
            console.log('  Cost:', `$${message.costUsd?.toFixed(4) || '0.0000'}`);
            console.log('  Processing time:', `${message.processingTimeMs || 0}ms`);
            ws.close();
            resolve(message);
            break;

          case 'error':
            console.error('❌ Error:', message.error);
            console.error('  Code:', message.code);
            ws.close();
            reject(new Error(message.error));
            break;

          case 'pong':
            // Ignore pong messages
            break;

          default:
            console.log('  Message data:', JSON.stringify(message, null, 2));
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      ws.close();
      reject(new Error('Test timed out after 60 seconds'));
    }, 60000);
  });
}

// Run test
console.log('🧪 Starting image generation test...\n');
testImageGeneration()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
