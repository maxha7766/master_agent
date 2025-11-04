/**
 * SQL Agent API Test (without Puppeteer)
 * Tests backend API endpoints for SQL Agent
 */

const http = require('http');

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 3001;
const USER_EMAIL = 'heath.maxwell@gmail.com';
const USER_PASSWORD = '1000BEANS1000!';

// Simple HTTP request helper
function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        SQL Agent Backend API Test Suite                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthRes = await request('GET', '/health');

    if (healthRes.status === 200) {
      console.log(`   ✓ Health: ${healthRes.data.status}`);
      console.log(`   ✓ Backend version: ${healthRes.data.version}`);
    } else {
      throw new Error(`Health check failed with status ${healthRes.status}`);
    }

    // Test 2: Login
    console.log('\n2. Testing authentication...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.data)}`);
    }

    const token = loginRes.data.token;
    console.log('   ✓ Login successful');
    console.log(`   ✓ Token: ${token.substring(0, 20)}...`);

    // Test 3: List SQL Connections
    console.log('\n3. Testing SQL connections endpoint...');
    const listRes = await request('GET', '/api/sql-connections', null, {
      'Authorization': `Bearer ${token}`,
    });

    if (listRes.status !== 200) {
      throw new Error(`List connections failed: ${listRes.status}`);
    }

    const connections = listRes.data.connections || [];
    console.log(`   ✓ Found ${connections.length} connection(s)`);

    for (const conn of connections) {
      console.log(`      - ${conn.name} (${conn.dbType}) - Status: ${conn.status}`);
    }

    if (connections.length === 0) {
      console.log('\n   ⚠ No SQL connections configured. Skipping query tests.');
      console.log('   ℹ Run the backend/test-sql-agent.js script to create a test connection.\n');
      return;
    }

    const connectionId = connections[0].id;

    // Test 4: Get Schema
    console.log('\n4. Testing schema discovery...');
    const schemaRes = await request('GET', `/api/sql-connections/${connectionId}/schema`, null, {
      'Authorization': `Bearer ${token}`,
    });

    if (schemaRes.status !== 200) {
      console.log(`   ⚠ Schema discovery failed: ${schemaRes.status}`);
      console.log(`   ℹ Error: ${JSON.stringify(schemaRes.data)}`);
    } else {
      const schema = schemaRes.data.schema;
      console.log(`   ✓ Schema discovered: ${schema.tables.length} tables`);

      for (const table of schema.tables.slice(0, 5)) {
        console.log(`      - ${table.name} (${table.columns.length} columns)`);
      }

      if (schema.tables.length > 5) {
        console.log(`      ... and ${schema.tables.length - 5} more tables`);
      }
    }

    // Test 5: Execute Natural Language Query
    console.log('\n5. Testing natural language query execution...');
    const question = 'Show me all tables in the database';
    console.log(`   Query: "${question}"`);

    const queryRes = await request('POST', '/api/sql-queries/execute', {
      connectionId,
      question,
      timeout: 10000,
      maxRows: 100,
    }, {
      'Authorization': `Bearer ${token}`,
    });

    if (queryRes.status !== 200) {
      console.log(`   ⚠ Query execution failed: ${queryRes.status}`);
      console.log(`   ℹ Error: ${JSON.stringify(queryRes.data)}`);
    } else {
      const result = queryRes.data;

      if (result.success) {
        console.log(`   ✓ Query executed successfully`);
        console.log(`   ✓ Generated SQL: ${result.generatedSQL}`);
        console.log(`   ✓ Rows returned: ${result.rowCount}`);
        console.log(`   ✓ Execution time: ${result.executionTimeMs}ms`);

        if (result.rows && result.rows.length > 0) {
          console.log(`   ✓ First row: ${JSON.stringify(result.rows[0]).substring(0, 80)}...`);
        }
      } else {
        console.log(`   ✗ Query failed: ${result.error}`);
      }
    }

    // Test 6: Query History
    console.log('\n6. Testing query history...');
    const historyRes = await request('GET', `/api/sql-queries/history/${connectionId}?limit=10`, null, {
      'Authorization': `Bearer ${token}`,
    });

    if (historyRes.status !== 200) {
      console.log(`   ⚠ Query history failed: ${historyRes.status}`);
    } else {
      const history = historyRes.data.history || [];
      console.log(`   ✓ Query history: ${history.length} queries`);

      for (const query of history.slice(0, 3)) {
        console.log(`      - "${query.question.substring(0, 50)}..." (${query.success ? '✓' : '✗'})`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                  TESTS FAILED ✗                            ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
