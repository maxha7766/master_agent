/**
 * Test Memory API Endpoints
 * Tests all memory system REST endpoints
 */

const API_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYzNjk1ODg0LCJpYXQiOjE3NjM2OTIyODQsImlzcyI6Imh0dHBzOi8vb21qd295eWhwZGF3anhzYnBhbWMuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjhmNTJmMDViLTQ3ZTUtNDAxOC05OGMyLTY5ZThkYWY5ZTVjOSIsImVtYWlsIjoiaGVhdGgubWF4d2VsbEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7fSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvdHAiLCJ0aW1lc3RhbXAiOjE3NjM2MDYyMTl9XSwic2Vzc2lvbl9pZCI6ImNhOTcyNDk5LTE5ZDktNGFhZi1hNzc1LWZjMmVlNmJlMDYzNSIsImlzX2Fub255bW91cyI6ZmFsc2V9.E_WjgAdqlcIh7k_0g0M0Ss-SvBjE47q9fL8A9LGNcE0';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return await response.json();
}

async function main() {
  console.log('🧪 Testing Memory API Endpoints\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: GET /api/memories/stats
  try {
    console.log('1️⃣ Testing GET /api/memories/stats...');
    const stats = await fetchAPI('/api/memories/stats');
    console.log('✅ Stats endpoint working:');
    console.log(`   - Total Memories: ${stats.totalMemories}`);
    console.log(`   - Total Entities: ${stats.totalEntities}`);
    console.log(`   - Avg Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
    console.log(`   - Avg Importance: ${(stats.avgImportance * 100).toFixed(1)}%`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 2: GET /api/memories
  try {
    console.log('2️⃣ Testing GET /api/memories...');
    const result = await fetchAPI('/api/memories');
    console.log(`✅ Memories endpoint working: ${result.count} memories found`);
    if (result.memories.length > 0) {
      const mem = result.memories[0];
      console.log(`   Sample: [${mem.memory_type}] ${mem.content.substring(0, 50)}...`);
    }
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 3: GET /api/memories/entities
  try {
    console.log('3️⃣ Testing GET /api/memories/entities...');
    const result = await fetchAPI('/api/memories/entities');
    console.log(`✅ Entities endpoint working: ${result.count} entities found`);
    if (result.entities.length > 0) {
      const entity = result.entities[0];
      console.log(`   Sample: [${entity.entity_type}] ${entity.name} (${entity.mention_count} mentions)`);
    }
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 4: GET /api/memories/summaries
  try {
    console.log('4️⃣ Testing GET /api/memories/summaries...');
    const result = await fetchAPI('/api/memories/summaries');
    console.log(`✅ Summaries endpoint working: ${result.count} summaries found`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 5: POST /api/memories/recalculate-importance
  try {
    console.log('5️⃣ Testing POST /api/memories/recalculate-importance...');
    const result = await fetchAPI('/api/memories/recalculate-importance', {
      method: 'POST',
    });
    console.log(`✅ Recalculate importance working: ${result.message}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 6: POST /api/memories/consolidate
  try {
    console.log('6️⃣ Testing POST /api/memories/consolidate...');
    const result = await fetchAPI('/api/memories/consolidate', {
      method: 'POST',
      body: JSON.stringify({ threshold: 0.95 }),
    });
    console.log(`✅ Consolidate working:`);
    console.log(`   - Similar pairs found: ${result.similarPairsFound}`);
    console.log(`   - Auto-merged: ${result.autoMerged}`);
    console.log(`   - Requires review: ${result.requiresReview}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('═══════════════════════════════════════\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
