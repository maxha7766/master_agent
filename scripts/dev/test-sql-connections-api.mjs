#!/usr/bin/env node

/**
 * Test SQL Connections API
 * Tests the full CRUD flow for database connections
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const BACKEND_URL = 'http://localhost:3001';
const TEST_EMAIL = 'heath.maxwell@gmail.com';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let authToken = '';
let testConnectionId = '';

async function apiCall(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function login() {
  console.log('\n🔐 Step 1: Getting auth token...');

  // Get user from Supabase
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === TEST_EMAIL);

  if (!user) {
    throw new Error(`User not found: ${TEST_EMAIL}`);
  }

  // Generate a session token for the user
  const { data: sessionData, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_EMAIL,
  });

  if (error) {
    throw new Error(`Failed to generate token: ${error.message}`);
  }

  // Use service role key for testing (simpler approach)
  authToken = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('✅ Auth token obtained');
  return { userId: user.id };
}

async function listConnections() {
  console.log('\n📋 Step 2: Listing existing connections...');
  const { status, data } = await apiCall('/api/sql-connections');

  if (status !== 200) {
    throw new Error(`List connections failed: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Found ${data.connections.length} existing connection(s)`);
  if (data.connections.length > 0) {
    console.log('   Connections:', data.connections.map(c => `${c.name} (${c.db_type})`).join(', '));
  }
  return data.connections;
}

async function createConnection() {
  console.log('\n➕ Step 3: Creating a test connection...');

  const connectionData = {
    name: 'Test PostgreSQL Connection',
    description: 'Created by API test script',
    dbType: 'postgresql',
    connectionDetails: {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass123',
    },
  };

  const { status, data } = await apiCall('/api/sql-connections', {
    method: 'POST',
    body: JSON.stringify(connectionData),
  });

  if (status !== 201) {
    throw new Error(`Create connection failed: ${JSON.stringify(data)}`);
  }

  testConnectionId = data.connection.id;
  console.log(`✅ Connection created with ID: ${testConnectionId}`);
  console.log(`   Name: ${data.connection.name}`);
  console.log(`   Type: ${data.connection.db_type}`);
  console.log(`   Status: ${data.connection.status}`);
  return data.connection;
}

async function getConnection() {
  console.log('\n🔍 Step 4: Fetching the created connection...');
  const { status, data } = await apiCall(`/api/sql-connections/${testConnectionId}`);

  if (status !== 200) {
    throw new Error(`Get connection failed: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Retrieved connection: ${data.connection.name}`);
  return data.connection;
}

async function deleteConnection() {
  console.log('\n🗑️  Step 5: Deleting the test connection...');
  const { status, data } = await apiCall(`/api/sql-connections/${testConnectionId}`, {
    method: 'DELETE',
  });

  if (status !== 200) {
    throw new Error(`Delete connection failed: ${JSON.stringify(data)}`);
  }

  console.log('✅ Connection deleted successfully');
  return data;
}

async function verifyDeletion() {
  console.log('\n✓ Step 6: Verifying deletion...');
  const { status } = await apiCall(`/api/sql-connections/${testConnectionId}`);

  if (status === 404) {
    console.log('✅ Connection no longer exists (as expected)');
  } else {
    throw new Error('Connection still exists after deletion!');
  }
}

async function runTests() {
  try {
    console.log('='.repeat(60));
    console.log('SQL Connections API Test Suite');
    console.log('='.repeat(60));

    await login();
    await listConnections();
    await createConnection();
    await getConnection();
    await deleteConnection();
    await verifyDeletion();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
