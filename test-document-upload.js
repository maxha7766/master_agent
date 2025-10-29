const puppeteer = require('puppeteer');

async function testDocumentUpload() {
  console.log('Starting Puppeteer test...');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
    page.on('response', async response => {
      if ((response.url().includes('auth') || response.url().includes('documents')) && response.status() >= 400) {
        console.log('API ERROR:', response.status(), response.url());
        try {
          const body = await response.text();
          console.log('Response body:', body);
        } catch (e) {
          // Ignore
        }
      }
      if (response.url().includes('documents') && response.status() === 201) {
        console.log('DOCUMENT UPLOADED:', response.status());
        try {
          const body = await response.text();
          console.log('Upload response:', body);
        } catch (e) {
          // Ignore
        }
      }
    });

    // Generate a unique email for testing
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    // Sign up with a new user
    console.log('Signing up new test user:', testEmail);
    await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for navigation after signup
    console.log('Waiting for signup to complete...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    console.log('Signup completed, current URL:', page.url());

    // Navigate to documents page
    console.log('Navigating to documents page...');
    await page.goto('http://localhost:3000/documents', { waitUntil: 'networkidle0' });

    // Wait for the file input
    console.log('Waiting for file input...');
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });

    // First, try with the test text file
    console.log('Uploading test text file...');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile('/tmp/test-document.txt');

    // Wait a bit for the upload to start
    console.log('Waiting for upload response...');
    await page.waitForTimeout(3000);

    // Check if any error messages appeared
    const errorMessage = await page.$('.bg-red-50');
    if (errorMessage) {
      const errorText = await page.evaluate(el => el.textContent, errorMessage);
      console.log('ERROR MESSAGE ON PAGE:', errorText);
    }

    // Check for progress bar or uploaded file
    console.log('Checking for progress/results...');

    // Wait up to 30 seconds for processing
    console.log('Waiting for document to appear in list...');
    await page.waitForTimeout(30000);

    // Take a screenshot
    await page.screenshot({ path: '/tmp/document-upload-result.png', fullPage: true });
    console.log('Screenshot saved to /tmp/document-upload-result.png');

    console.log('Test completed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    try {
      await page.screenshot({ path: '/tmp/document-upload-error.png', fullPage: true });
      console.log('Error screenshot saved to /tmp/document-upload-error.png');
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError.message);
    }
  } finally {
    // Keep browser open for inspection
    console.log('Browser will remain open for inspection. Close manually when done.');
    // await browser.close();
  }
}

testDocumentUpload();
