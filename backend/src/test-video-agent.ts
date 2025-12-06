import { VideoAgent } from './agents/video/agent.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

async function testVideoAgent() {
    console.log('🎬 Testing Video Agent...');

    const agent = new VideoAgent();
    await agent.initialize();

    // Mock user ID (ensure this user exists in your DB or use a valid one)
    // For safety, we should probably check if we can get a valid user or just fail if RLS blocks it.
    // Assuming we have a test user or we can bypass RLS if using service role key (which we are in backend).
    const userId = '07f2bcc5-ef5e-4170-adbe-70c7669f03ab'; // Replace with valid UUID if needed for FK constraints

    try {
        console.log('   Generating video from text...');
        const result = await agent.processRequest({
            userId,
            operation: 'text-to-video',
            parameters: {
                prompt: 'A cinematic drone shot of a futuristic city at sunset, cyberpunk style',
                duration: 5,
                resolution: '720p'
            }
        });

        if (result.success) {
            console.log('   ✅ Video generated successfully!');
            console.log('   URL:', (result.data as any).videoUrl);
            console.log('   Cost:', result.costUsd);
        } else {
            console.error('   ❌ Video generation failed:', result.error);
        }

    } catch (error) {
        console.error('   ❌ Test failed:', error);
    }
}

// Only run if called directly
testVideoAgent();
// Commented out to prevent accidental run. 
// To run: uncomment and ensure valid user_id if FK constraints exist.
