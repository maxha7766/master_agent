/**
 * Test script to verify all added models work correctly
 * Tests each model with a simple chat completion request
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TEST_PROMPT = 'Say "Hello! I am working correctly." in exactly that format.';

// All working models (tested and verified)
const MODELS_TO_TEST = {
  anthropic: [
    'claude-sonnet-4-5-20250929',
    'claude-3-haiku-20240307',
  ],
  openai: {
    gpt5: [
      'gpt-5.1',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
    ],
    gpt4: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
    reasoning: [
      'o1',
    ],
  },
};

const results = {
  passed: [],
  failed: [],
};

/**
 * Test an Anthropic model
 */
async function testAnthropicModel(model) {
  try {
    console.log(`\n🧪 Testing ${model}...`);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 100,
      messages: [{ role: 'user', content: TEST_PROMPT }],
    });

    const content = response.content[0]?.text || '';

    console.log(`✅ ${model} - SUCCESS`);
    console.log(`   Response: ${content}`);
    console.log(`   Tokens: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`);

    results.passed.push({
      model,
      provider: 'anthropic',
      response: content,
      tokens: response.usage,
    });

    return true;
  } catch (error) {
    console.log(`❌ ${model} - FAILED`);
    console.log(`   Error: ${error.message}`);

    results.failed.push({
      model,
      provider: 'anthropic',
      error: error.message,
      errorType: error.constructor.name,
    });

    return false;
  }
}

/**
 * Test an OpenAI model with standard Chat Completions API
 */
async function testOpenAIModel(model, useTemperature = true) {
  try {
    console.log(`\n🧪 Testing ${model}...`);

    const isGPT5 = model.startsWith('gpt-5');
    const isO1 = model.startsWith('o1');
    const useNewParams = isGPT5 || isO1;

    const params = {
      model,
      messages: [{ role: 'user', content: TEST_PROMPT }],
    };

    // GPT-5 and o1 models use max_completion_tokens instead of max_tokens
    if (useNewParams) {
      params.max_completion_tokens = 100;
      // Don't add temperature or top_p
    } else {
      params.max_tokens = 100;
      if (useTemperature) {
        params.temperature = 0.7;
      }
    }

    const response = await openai.chat.completions.create(params);

    const content = response.choices[0]?.message?.content || '';

    console.log(`✅ ${model} - SUCCESS`);
    console.log(`   Response: ${content}`);
    console.log(`   Tokens: ${response.usage?.prompt_tokens || 0} input, ${response.usage?.completion_tokens || 0} output`);

    results.passed.push({
      model,
      provider: 'openai',
      response: content,
      tokens: response.usage,
    });

    return true;
  } catch (error) {
    console.log(`❌ ${model} - FAILED`);
    console.log(`   Error: ${error.message}`);

    // If temperature error, retry without it
    if (error.message.includes('temperature') && useTemperature) {
      console.log(`   🔄 Retrying without temperature parameter...`);
      return await testOpenAIModel(model, false);
    }

    results.failed.push({
      model,
      provider: 'openai',
      error: error.message,
      errorType: error.constructor.name,
    });

    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 TESTING ALL ADDED MODELS');
  console.log('═══════════════════════════════════════════════════════════');

  // Test Anthropic models
  console.log('\n\n📘 TESTING ANTHROPIC MODELS');
  console.log('───────────────────────────────────────────────────────────');
  for (const model of MODELS_TO_TEST.anthropic) {
    await testAnthropicModel(model);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  // Test GPT-5 models (no temperature support)
  console.log('\n\n📗 TESTING GPT-5 SERIES');
  console.log('───────────────────────────────────────────────────────────');
  for (const model of MODELS_TO_TEST.openai.gpt5) {
    await testOpenAIModel(model, false);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test GPT-4 models (with temperature support)
  console.log('\n\n📙 TESTING GPT-4 SERIES');
  console.log('───────────────────────────────────────────────────────────');
  for (const model of MODELS_TO_TEST.openai.gpt4) {
    await testOpenAIModel(model, true);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test reasoning models (no temperature support)
  console.log('\n\n📕 TESTING REASONING MODELS (o-series)');
  console.log('───────────────────────────────────────────────────────────');
  for (const model of MODELS_TO_TEST.openai.reasoning) {
    await testOpenAIModel(model, false);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  console.log(`\n✅ PASSED: ${results.passed.length} models`);
  results.passed.forEach(result => {
    console.log(`   • ${result.model} (${result.provider})`);
  });

  console.log(`\n❌ FAILED: ${results.failed.length} models`);
  results.failed.forEach(result => {
    console.log(`   • ${result.model} (${result.provider})`);
    console.log(`     Error: ${result.error}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════');

  // Exit with error code if any tests failed
  if (results.failed.length > 0) {
    console.log('\n⚠️  Some models failed testing. Review the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All models passed testing!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error during testing:', error);
  process.exit(1);
});
