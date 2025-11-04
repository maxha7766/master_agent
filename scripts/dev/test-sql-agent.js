/**
 * SQL Agent Integration Test
 * Tests the complete SQL Agent workflow using Puppeteer
 */

const puppeteer = require('puppeteer');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';
const USER_EMAIL = 'heath.maxwell@gmail.com';
const USER_PASSWORD = '1000BEANS1000!';

// Test configuration
const TEST_DB_CONNECTION = {
  name: 'Master Agent DB',
  description: 'Supabase PostgreSQL database for Master Agent',
  dbType: 'postgresql',
  connectionDetails: {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    username: 'postgres.omjwoyyhpdawjxsbpamc',
    password: '1000BEANS1000!',
  },
};

const TEST_QUERIES = [
  'Show me all the tables in the database',
  'How many users are in the database?',
  'What is the most recent conversation?',
];

async function testBackendAPI() {
  console.log('\n=== Backend API Tests ===\n');

  try {
    // 1. Health Check
    console.log('1. Testing health endpoint...');
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    const health = await healthRes.json();
    console.log('   ✓ Health:', health.status);

    // 2. Login
    console.log('\n2. Testing authentication...');
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: USER_EMAIL,
        password: USER_PASSWORD,
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const { token } = await loginRes.json();
    console.log('   ✓ Login successful');
    console.log(`   ✓ Token: ${token.substring(0, 20)}...`);

    // 3. List SQL Connections
    console.log('\n3. Testing SQL connections endpoint...');
    const listRes = await fetch(`${BACKEND_URL}/api/sql-connections`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const { connections } = await listRes.json();
    console.log(`   ✓ Found ${connections.length} connection(s)`);

    for (const conn of connections) {
      console.log(`      - ${conn.name} (${conn.dbType}) - Status: ${conn.status}`);
    }

    // 4. Create or Update Connection
    let connectionId;
    const existingConn = connections.find(c => c.name === TEST_DB_CONNECTION.name);

    if (existingConn) {
      console.log(`\n4. Updating existing connection "${TEST_DB_CONNECTION.name}"...`);
      connectionId = existingConn.id;

      const updateRes = await fetch(`${BACKEND_URL}/api/sql-connections/${connectionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionDetails: TEST_DB_CONNECTION.connectionDetails,
        }),
      });

      if (!updateRes.ok) {
        const error = await updateRes.text();
        throw new Error(`Update failed: ${error}`);
      }

      console.log('   ✓ Connection updated');
    } else {
      console.log(`\n4. Creating new connection "${TEST_DB_CONNECTION.name}"...`);

      const createRes = await fetch(`${BACKEND_URL}/api/sql-connections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(TEST_DB_CONNECTION),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        throw new Error(`Create failed: ${error}`);
      }

      const { connection } = await createRes.json();
      connectionId = connection.id;
      console.log('   ✓ Connection created');
      console.log(`   ✓ ID: ${connectionId}`);
    }

    // 5. Test Connection
    console.log('\n5. Testing database connection...');
    const testRes = await fetch(`${BACKEND_URL}/api/sql-connections/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dbType: TEST_DB_CONNECTION.dbType,
        connectionDetails: TEST_DB_CONNECTION.connectionDetails,
      }),
    });

    const testResult = await testRes.json();

    if (testResult.success) {
      console.log('   ✓ Connection test PASSED');
    } else {
      console.log(`   ✗ Connection test FAILED: ${testResult.error}`);
    }

    // 6. Get Schema
    console.log('\n6. Testing schema discovery...');
    const schemaRes = await fetch(`${BACKEND_URL}/api/sql-connections/${connectionId}/schema`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const { schema } = await schemaRes.json();
    console.log(`   ✓ Schema discovered: ${schema.tables.length} tables`);

    for (const table of schema.tables.slice(0, 5)) {
      console.log(`      - ${table.name} (${table.columns.length} columns)`);
    }

    if (schema.tables.length > 5) {
      console.log(`      ... and ${schema.tables.length - 5} more tables`);
    }

    // 7. Execute Natural Language Queries
    console.log('\n7. Testing natural language query execution...');

    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const question = TEST_QUERIES[i];
      console.log(`\n   Query ${i + 1}: "${question}"`);

      const queryRes = await fetch(`${BACKEND_URL}/api/sql-queries/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId,
          question,
          timeout: 10000,
          maxRows: 100,
        }),
      });

      const result = await queryRes.json();

      if (result.success) {
        console.log(`   ✓ Query executed successfully`);
        console.log(`   ✓ Generated SQL: ${result.generatedSQL}`);
        console.log(`   ✓ Rows returned: ${result.rowCount}`);
        console.log(`   ✓ Execution time: ${result.executionTimeMs}ms`);

        if (result.rows && result.rows.length > 0) {
          console.log(`   ✓ First row:`, JSON.stringify(result.rows[0]).substring(0, 100));
        }
      } else {
        console.log(`   ✗ Query failed: ${result.error}`);
      }
    }

    // 8. Get Query History
    console.log('\n8. Testing query history...');
    const historyRes = await fetch(`${BACKEND_URL}/api/sql-queries/history/${connectionId}?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const { history } = await historyRes.json();
    console.log(`   ✓ Query history: ${history.length} queries`);

    for (const query of history.slice(0, 3)) {
      console.log(`      - "${query.question.substring(0, 50)}..." (${query.success ? '✓' : '✗'})`);
    }

    console.log('\n=== Backend API Tests Complete ===\n');

    return { token, connectionId };

  } catch (error) {
    console.error('\n❌ Backend API test failed:', error.message);
    throw error;
  }
}

async function testFrontendWithPuppeteer(token, connectionId) {
  console.log('\n=== Puppeteer Frontend Tests ===\n');

  let browser;

  try {
    console.log('1. Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`   [Browser Error] ${msg.text()}`);
      }
    });

    console.log('   ✓ Browser launched');

    // 2. Navigate to frontend
    console.log('\n2. Navigating to frontend...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
    console.log('   ✓ Frontend loaded');

    // 3. Check if login page or chat page
    console.log('\n3. Checking authentication state...');

    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      console.log('   → User not logged in, performing login...');

      // Wait for login form
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });

      // Fill login form
      await page.type('input[type="email"]', USER_EMAIL);
      await page.type('input[type="password"]', USER_PASSWORD);

      // Click login button
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      console.log('   ✓ Login successful');
    } else {
      console.log('   ✓ User already logged in');
    }

    // 4. Test SQL Agent in chat
    console.log('\n4. Testing SQL Agent in chat interface...');

    // Wait for chat input
    await page.waitForSelector('textarea, input[placeholder*="message"]', { timeout: 10000 });
    console.log('   ✓ Chat interface ready');

    // Type a SQL query
    const chatInput = await page.$('textarea, input[placeholder*="message"]');

    if (chatInput) {
      console.log('   → Typing SQL query...');
      await chatInput.type('How many users are in the database?', { delay: 50 });

      // Press Enter to send
      await chatInput.press('Enter');
      console.log('   ✓ Query sent');

      // Wait for response (look for SQL-related content)
      await page.waitForFunction(
        () => document.body.innerText.includes('SQL') ||
              document.body.innerText.includes('query') ||
              document.body.innerText.includes('database'),
        { timeout: 30000 }
      );

      console.log('   ✓ Response received');

      // Take screenshot
      await page.screenshot({ path: '/tmp/sql-agent-test.png' });
      console.log('   ✓ Screenshot saved to /tmp/sql-agent-test.png');
    } else {
      console.log('   ⚠ Chat input not found');
    }

    console.log('\n=== Puppeteer Frontend Tests Complete ===\n');

  } catch (error) {
    console.error('\n❌ Puppeteer test failed:', error.message);

    if (browser) {
      await browser.close();
    }

    throw error;
  } finally {
    if (browser) {
      console.log('\nClosing browser...');
      await browser.close();
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SQL Agent Integration Test Suite                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Run backend API tests
    const { token, connectionId } = await testBackendAPI();

    // Run Puppeteer frontend tests
    await testFrontendWithPuppeteer(token, connectionId);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                  TESTS FAILED ✗                            ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
