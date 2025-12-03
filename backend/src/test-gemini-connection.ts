import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiConnection() {
    console.log('🔌 Testing Gemini API Connection...');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in environment variables.');
        console.log('   Please ensure you have added your key to the .env file.');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log('   Listing available models...');

        // Test gemini-pro (Optional)
        try {
            console.log('   Testing "gemini-pro"...');
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            await model.generateContent('Hello');
            console.log('   ✅ "gemini-pro" works!');
        } catch (e: any) {
            console.log(`   ⚠️ "gemini-pro" failed: ${e.message.split('[')[0]}`);
        }

        // Test Gemini 3 Pro Preview (Target)
        try {
            console.log('   Testing "gemini-3-pro-preview"...');
            const model3 = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
            const result3 = await model3.generateContent('Hello Gemini 3');
            console.log(`   ✅ "gemini-3-pro-preview" works! Response: ${result3.response.text()}`);
        } catch (e: any) {
            console.error(`   ❌ "gemini-3-pro-preview" failed: ${e.message}`);
        }

        console.log('🎉 Connectivity check complete!');
    } catch (error: any) {
        console.error('❌ API Error:');
        console.error(`   ${error.message}`);

        if (error.message.includes('404')) {
            console.log('   👉 The model ID might be incorrect or not available to your API key.');
            console.log('      Try "gemini-1.5-pro-latest" or check Google AI Studio.');
        }
    }
}

testGeminiConnection();
