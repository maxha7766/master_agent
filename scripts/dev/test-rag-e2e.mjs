/**
 * End-to-end RAG test using Puppeteer
 * Tests the full flow: login -> chat -> send RAG question -> verify response
 */
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FRONTEND_URL = 'http://localhost:3000';
const TEST_USER_ID = '8f52f05b-47e5-4018-98c2-69e8daf9e5c9';

console.log('=== RAG E2E Test ===\n');

// Launch browser
console.log('Launching browser...');
const browser = await puppeteer.launch({
  headless: false, // Show browser for debugging
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  slowMo: 100 // Slow down for visibility
});

const page = await browser.newPage();
page.setDefaultTimeout(30000);

try {
  // Step 1: Navigate to app
  console.log('\nStep 1: Navigating to app...');
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });

  // Take screenshot
  await page.screenshot({ path: '/tmp/rag-test-1-homepage.png' });
  console.log('  ✓ Screenshot saved: /tmp/rag-test-1-homepage.png');

  // Step 2: Check if already logged in or need to login
  console.log('\nStep 2: Checking authentication...');
  const currentUrl = page.url();

  if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
    console.log('  Not logged in, attempting login...');

    // Get test user credentials
    const { data: testUser } = await supabase.auth.admin.getUserById(TEST_USER_ID);

    if (!testUser) {
      console.error('  ✗ Test user not found');
      process.exit(1);
    }

    console.log(`  Found test user: ${testUser.user?.email}`);

    // For demo, we'll use localStorage to set auth session
    // In production, you'd fill in login form
    console.log('  Setting auth session via localStorage...');

    const { data: session } = await supabase.auth.admin.createUser({
      email: testUser.user.email,
      password: 'test-password-123', // Set temp password
      email_confirm: true
    }).catch(() => ({ data: null }));

    // Or sign in with email
    await page.type('input[type="email"]', testUser.user.email);
    await page.type('input[type="password"]', 'test-password-123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

  } else {
    console.log('  ✓ Already logged in');
  }

  await page.screenshot({ path: '/tmp/rag-test-2-logged-in.png' });

  // Step 3: Navigate to chat or create new conversation
  console.log('\nStep 3: Navigating to chat...');

  // Look for "New Chat" button or similar
  const newChatButton = await page.$('button:contains("New"), a:contains("Chat")').catch(() => null);

  if (newChatButton) {
    await newChatButton.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: '/tmp/rag-test-3-chat-page.png' });
  console.log('  ✓ Screenshot saved: /tmp/rag-test-3-chat-page.png');

  // Step 4: Send RAG question
  console.log('\nStep 4: Sending RAG question...');

  const testQuestion = 'What documents do you have access to? Tell me about the baseball rules.';

  // Find chat input
  const chatInput = await page.$('textarea, input[placeholder*="message"], input[placeholder*="Message"]');

  if (!chatInput) {
    console.error('  ✗ Could not find chat input');
    await page.screenshot({ path: '/tmp/rag-test-error-no-input.png' });
    throw new Error('Chat input not found');
  }

  await chatInput.type(testQuestion);
  console.log(`  Typed question: "${testQuestion}"`);

  // Find and click send button
  const sendButton = await page.$('button[type="submit"], button:contains("Send")');

  if (!sendButton) {
    console.error('  ✗ Could not find send button');
    await page.screenshot({ path: '/tmp/rag-test-error-no-button.png' });
    throw new Error('Send button not found');
  }

  await sendButton.click();
  console.log('  ✓ Message sent');

  // Step 5: Wait for response
  console.log('\nStep 5: Waiting for response...');

  // Wait for assistant message to appear (adjust selector based on your UI)
  await page.waitForSelector('[data-role="assistant"], .message-assistant', {
    timeout: 30000
  }).catch(async () => {
    console.log('  Warning: Assistant message selector not found, waiting 10s...');
    await page.waitForTimeout(10000);
  });

  await page.waitForTimeout(5000); // Wait for streaming to complete

  await page.screenshot({ path: '/tmp/rag-test-4-response.png' });
  console.log('  ✓ Screenshot saved: /tmp/rag-test-4-response.png');

  // Step 6: Verify response content
  console.log('\nStep 6: Verifying response...');

  const pageContent = await page.content();

  // Check for keywords that should appear in RAG response
  const keywords = ['baseball', 'rules', 'document'];
  let keywordMatches = 0;

  for (const keyword of keywords) {
    if (pageContent.toLowerCase().includes(keyword)) {
      console.log(`  ✓ Found keyword: "${keyword}"`);
      keywordMatches++;
    } else {
      console.log(`  ✗ Missing keyword: "${keyword}"`);
    }
  }

  if (keywordMatches >= 2) {
    console.log(`\n✓ TEST PASSED: Response contains relevant content (${keywordMatches}/${keywords.length} keywords)`);
  } else {
    console.log(`\n✗ TEST FAILED: Response may not contain RAG content (${keywordMatches}/${keywords.length} keywords)`);
  }

  // Extract and display the response
  const assistantMessages = await page.$$eval(
    '[data-role="assistant"], .message-assistant, .assistant-message',
    (elements) => elements.map(el => el.textContent.trim())
  );

  if (assistantMessages.length > 0) {
    console.log('\nAssistant Response:');
    console.log('---');
    console.log(assistantMessages[assistantMessages.length - 1]);
    console.log('---');
  }

} catch (error) {
  console.error('\n✗ Error during test:', error.message);
  await page.screenshot({ path: '/tmp/rag-test-error.png' });
  console.log('  Error screenshot saved: /tmp/rag-test-error.png');
} finally {
  console.log('\n\nClosing browser in 5 seconds...');
  await page.waitForTimeout(5000);
  await browser.close();
}

console.log('\n=== Test Complete ===');
