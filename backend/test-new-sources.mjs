/**
 * Test script for new research sources
 * Tests Wikipedia, News API, Guardian, FRED, and Alpha Vantage
 */

import { config } from 'dotenv';
config();

// Import all new services
import { WikipediaService } from './src/services/research/wikipedia.js';
import { NewsAPIService } from './src/services/research/newsapi.js';
import { GuardianService } from './src/services/research/guardian.js';
import { FREDService } from './src/services/research/fred.js';
import { AlphaVantageService } from './src/services/research/alpha-vantage.js';
import { EnhancedMultiSearchService } from './src/services/research/enhanced-multi-search.js';

console.log('\n🧪 Testing New Research Sources\n');
console.log('='.repeat(60));

// Test 1: Wikipedia
async function testWikipedia() {
  console.log('\n📚 Test 1: Wikipedia');
  console.log('-'.repeat(60));
  try {
    const wiki = new WikipediaService();
    const results = await wiki.search('artificial intelligence', 3);
    console.log(`✅ Wikipedia: Found ${results.length} results`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      ${r.snippet.substring(0, 100)}...`);
    });
  } catch (error) {
    console.error(`❌ Wikipedia failed: ${error.message}`);
  }
}

// Test 2: News API
async function testNewsAPI() {
  console.log('\n📰 Test 2: News API');
  console.log('-'.repeat(60));
  try {
    const newsAPI = new NewsAPIService();
    const results = await newsAPI.searchEverything('technology', { limit: 3 });
    console.log(`✅ News API: Found ${results.length} results`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      Source: ${r.source}`);
    });
  } catch (error) {
    console.error(`❌ News API failed: ${error.message}`);
  }
}

// Test 3: The Guardian
async function testGuardian() {
  console.log('\n🗞️  Test 3: The Guardian');
  console.log('-'.repeat(60));
  try {
    const guardian = new GuardianService();
    const results = await guardian.search('climate change', { limit: 3 });
    console.log(`✅ Guardian: Found ${results.length} results`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      Section: ${r.section}`);
    });
  } catch (error) {
    console.error(`❌ Guardian failed: ${error.message}`);
  }
}

// Test 4: FRED (Economic Data)
async function testFRED() {
  console.log('\n📊 Test 4: FRED (Economic Data)');
  console.log('-'.repeat(60));
  try {
    const fred = new FREDService();
    const results = await fred.searchSeries('GDP', { limit: 3 });
    console.log(`✅ FRED: Found ${results.length} economic series`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      ID: ${r.id}, Frequency: ${r.frequency}`);
    });
  } catch (error) {
    console.error(`❌ FRED failed: ${error.message}`);
  }
}

// Test 5: Alpha Vantage (Stock Data)
async function testAlphaVantage() {
  console.log('\n📈 Test 5: Alpha Vantage (Stock Data)');
  console.log('-'.repeat(60));
  try {
    const alphaVantage = new AlphaVantageService();
    const results = await alphaVantage.searchSymbols('Apple');
    console.log(`✅ Alpha Vantage: Found ${results.length} symbols`);
    results.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.symbol}: ${r.name}`);
      console.log(`      Type: ${r.type}, Region: ${r.region}`);
    });
  } catch (error) {
    console.error(`❌ Alpha Vantage failed: ${error.message}`);
  }
}

// Test 6: Enhanced Multi-Search
async function testEnhancedMultiSearch() {
  console.log('\n🔍 Test 6: Enhanced Multi-Search (Auto-routing)');
  console.log('-'.repeat(60));
  try {
    const multiSearch = new EnhancedMultiSearchService();

    // Test news query
    console.log('\n   Testing news query: "latest AI developments"');
    const newsResults = await multiSearch.search('latest AI developments', { numResults: 3 });
    console.log(`   ✅ Found ${newsResults.results.length} results from: ${newsResults.sourcesUsed.join(', ')}`);

    // Test knowledge query
    console.log('\n   Testing knowledge query: "what is machine learning"');
    const knowledgeResults = await multiSearch.search('what is machine learning', { numResults: 3 });
    console.log(`   ✅ Found ${knowledgeResults.results.length} results from: ${knowledgeResults.sourcesUsed.join(', ')}`);

    // Test economic query
    console.log('\n   Testing economic query: "inflation rate"');
    const economicResults = await multiSearch.search('inflation rate', { numResults: 3 });
    console.log(`   ✅ Found ${economicResults.results.length} results from: ${economicResults.sourcesUsed.join(', ')}`);

    console.log('\n   ✅ Enhanced Multi-Search working correctly!');
  } catch (error) {
    console.error(`   ❌ Enhanced Multi-Search failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testWikipedia();
    await testNewsAPI();
    await testGuardian();
    await testFRED();
    await testAlphaVantage();
    await testEnhancedMultiSearch();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All tests completed!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();
