/**
 * Fix the test database connection hostname
 */

const BACKEND_URL = 'http://localhost:3001';
const USER_EMAIL = 'heath.maxwell@gmail.com';
const USER_PASSWORD = '1000BEANS1000!';

async function main() {
  try {
    // 1. Login to get auth token
    console.log('Logging in...');
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
    console.log('✓ Logged in successfully');

    // 2. Get existing connections
    console.log('\nFetching existing connections...');
    const listRes = await fetch(`${BACKEND_URL}/api/sql-connections`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const { connections } = await listRes.json();
    console.log(`Found ${connections.length} connection(s)`);

    for (const conn of connections) {
      console.log(`  - ${conn.name} (${conn.dbType})`);
    }

    // 3. Find and update the Test Database connection
    const testConn = connections.find(c => c.name === 'Test Database');

    if (testConn) {
      console.log(`\nUpdating "${testConn.name}" connection...`);

      const updateRes = await fetch(`${BACKEND_URL}/api/sql-connections/${testConn.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionDetails: {
            host: 'aws-0-us-east-1.pooler.supabase.com',
            port: 6543,
            database: 'postgres',
            username: 'postgres.omjwoyyhpdawjxsbpamc',
            password: '1000BEANS1000!',
          },
        }),
      });

      if (!updateRes.ok) {
        const error = await updateRes.text();
        throw new Error(`Update failed: ${error}`);
      }

      const { connection: updated } = await updateRes.json();
      console.log('✓ Connection updated successfully');
      console.log(`  Status: ${updated.status}`);

      // 4. Test the connection
      console.log('\nTesting connection...');
      const testRes = await fetch(`${BACKEND_URL}/api/sql-connections/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dbType: 'postgresql',
          connectionDetails: {
            host: 'aws-0-us-east-1.pooler.supabase.com',
            port: 6543,
            database: 'postgres',
            username: 'postgres.omjwoyyhpdawjxsbpamc',
            password: '1000BEANS1000!',
          },
        }),
      });

      const testResult = await testRes.json();

      if (testResult.success) {
        console.log('✓ Connection test PASSED');
      } else {
        console.log('✗ Connection test FAILED:', testResult.error);
      }
    } else {
      console.log('\n⚠ No "Test Database" connection found. Creating new one...');

      const createRes = await fetch(`${BACKEND_URL}/api/sql-connections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        throw new Error(`Create failed: ${error}`);
      }

      const { connection } = await createRes.json();
      console.log('✓ New connection created');
      console.log(`  ID: ${connection.id}`);
      console.log(`  Name: ${connection.name}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
