
import { handleUserQuery } from './agents/master/orchestrator.js';
import { getTestUser } from './get-test-user.js';

async function testChatVideo() {
    try {
        const userId = await getTestUser();
        console.log('Testing with User ID:', userId);

        const prompt = "Generate a video of a futuristic city with flying cars";
        console.log(`\nSending prompt: "${prompt}"`);

        const generator = handleUserQuery(prompt, userId, []);

        for await (const chunk of generator) {
            if (chunk.content) {
                process.stdout.write(chunk.content);
            }
            if (chunk.metadata && chunk.metadata.type === 'video_generation_result') {
                console.log('\n\n✅ Video Generation Success!');
                console.log('Video URL:', chunk.metadata.videoUrl);
                console.log('Cost:', chunk.metadata.costUsd);
            }
        }
        console.log('\n\nTest Complete');
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testChatVideo();
