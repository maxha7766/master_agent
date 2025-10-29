const puppeteer = require('puppeteer');
const fs = require('fs');

async function testUpload() {
  console.log('Starting simple upload test...');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Enable logging
    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      if (url.includes('/api/') && (status >= 400 || url.includes('documents'))) {
        console.log(`API: ${status} ${url}`);
        if (status >= 400) {
          try {
            const text = await response.text();
            console.log('Response:', text);
          } catch (e) {}
        }
      }
    });

    // Go to login page
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

    // Login with existing user
    console.log('Logging in...');
    await page.type('input[type="email"]', 'heath.maxwell@gmail.com');
    await page.type('input[type="password"]', 'HeathMaxwell88@');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    console.log('Logged in, URL:', page.url());

    // Go to documents page
    console.log('Going to documents page...');
    await page.goto('http://localhost:3000/documents', { waitUntil: 'networkidle0' });

    // Wait for file input
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    console.log('Found file input');

    // Upload file
    console.log('Uploading /tmp/test-document.txt...');
    const input = await page.$('input[type="file"]');
    await input.uploadFile('/tmp/test-document.txt');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/upload-test.png', fullPage: true });
    console.log('Screenshot saved to /tmp/upload-test.png');

    // Check for success
    const documents = await page.$$('[data-testid="document-item"]');
    console.log(`Found ${documents.length} documents`);

    console.log('Test complete!');
  } catch (error) {
    console.error('Test failed:', error.message);
    try {
      await page.screenshot({ path: '/tmp/upload-error.png', fullPage: true });
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

testUpload();
