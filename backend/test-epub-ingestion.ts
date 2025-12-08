
import fs from 'fs';
import https from 'https';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'dummy-key-for-testing'; // Prevent crash on import

const SAMPLE_URL = 'https://github.com/IDPF/epub3-samples/releases/download/20170606/moby-dick.epub';
const TEMP_FILE = 'moby-dick.epub';

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                // handle redirect if needed, but github might redirect
                if (response.statusCode === 302 && response.headers.location) {
                    downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                    return;
                }
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function run() {
    // Dynamic import to ensure env vars are set first
    const { documentProcessor } = await import('./src/services/documents/processor.ts');

    console.log('📚 Downloading sample EPUB...');
    try {
        await downloadFile(SAMPLE_URL, TEMP_FILE);
        console.log('✅ Download complete.');

        console.log('📖 Extracting text from EPUB...');
        const text = await documentProcessor.extractText(TEMP_FILE, 'application/epub+zip');

        console.log('-----------------------------------');
        console.log(`✅ Extraction Successful!`);
        console.log(`Total Characters: ${text.length}`);
        console.log(`Preview (first 500 chars):\n${text.substring(0, 500)}`);
        console.log('-----------------------------------');

        // Cleanup
        fs.unlinkSync(TEMP_FILE);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

run();
