/**
 * Quick test of new research sources
 */

import { config } from 'dotenv';
config(); // Load .env file

import { WikipediaService } from './services/research/wikipedia.js';
import { NewsAPIService } from './services/research/newsapi.js';
import { GuardianService } from './services/research/guardian.js';

async function quickTest() {
  console.log('\n🧪 Quick Test of New Sources\n');

  // Test Wikipedia (no API key needed)
  console.log('1. Testing Wikipedia...');
  try {
    const wiki = new WikipediaService();
    const results = await wiki.search('TypeScript programming', 2);
    console.log(`   ✅ Wikipedia: ${results.length} results`);
    results.forEach(r => console.log(`      - ${r.title}`));
  } catch (error: any) {
    console.log(`   ❌ Wikipedia failed: ${error.message}`);
  }

  // Test News API
  console.log('\n2. Testing News API...');
  try {
    const news = new NewsAPIService();
    const results = await news.searchEverything('technology', { limit: 2 });
    console.log(`   ✅ News API: ${results.length} results`);
    results.forEach(r => console.log(`      - ${r.title.substring(0, 60)}...`));
  } catch (error: any) {
    console.log(`   ❌ News API failed: ${error.message}`);
  }

  // Test Guardian
  console.log('\n3. Testing Guardian...');
  try {
    const guardian = new GuardianService();
    const results = await guardian.search('politics', { limit: 2 });
    console.log(`   ✅ Guardian: ${results.length} results`);
    results.forEach(r => console.log(`      - ${r.title.substring(0, 60)}...`));
  } catch (error: any) {
    console.log(`   ❌ Guardian failed: ${error.message}`);
  }

  console.log('\n✅ Quick test complete!\n');
}

quickTest();
