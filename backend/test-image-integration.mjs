/**
 * Test Image Generation Integration with Master Orchestrator
 */

// Simple test to verify image intent detection
const testQueries = [
  "create an image of a dog",
  "can you create and image of a dog?",
  "generate a picture of a sunset",
  "make an illustration of a cat",
  "show me a diagram of the solar system",
  "what documents do I have?",
  "how many rows are in the data?",
];

console.log('Testing image intent detection:\n');

for (const query of testQueries) {
  const isImage = /\b(create|generate|make|draw|produce|design|build|show me|visualize|imagine|picture of)\s+(an?|some|the)?\s*(image|picture|photo|illustration|artwork|visual|graphic|diagram)/i.test(query);

  console.log(`Query: "${query}"`);
  console.log(`  → Image intent: ${isImage ? '✓ YES' : '✗ NO'}`);
  console.log('');
}
