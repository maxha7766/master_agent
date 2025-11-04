#!/usr/bin/env node

/**
 * Test Research Agent Directly
 * Tests the ResearchAgent class without going through the API
 */

import dotenv from 'dotenv';
import { ResearchAgent } from './src/agents/research/index.ts';

// Load environment variables
dotenv.config();

async function testResearchAgent() {
  console.log('='.repeat(60));
  console.log('Research Agent Direct Test');
  console.log('='.repeat(60));

  console.log('\n🔬 Testing research agent with query...');
  console.log('   Query: "Latest developments in AI language models 2025"');

  try {
    const agent = new ResearchAgent();
    const result = await agent.executeResearch(
      'Latest developments in AI language models 2025',
      5
    );

    console.log('\n✅ Research completed successfully!');
    console.log(`   Query: ${result.query}`);
    console.log(`   Domain: ${result.domain}`);
    console.log(`   Sources found: ${result.sources.length}`);
    console.log(`   Total results: ${result.totalResults}`);

    // Display all sources
    console.log('\n📚 Sources:');
    result.sources.forEach((source, index) => {
      console.log(`\n${index + 1}. ${source.title}`);
      console.log(`   Source: ${source.source}`);
      console.log(`   Score: ${source.score.toFixed(2)}`);
      console.log(`   URL: ${source.url}`);
      console.log(`   Snippet: ${source.content.substring(0, 150)}...`);
      if (source.published_date) {
        console.log(`   Published: ${source.published_date}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

testResearchAgent();
