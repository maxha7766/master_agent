/**
 * Test the updated regex pattern
 */

const testQuery = "can you give me a picture of a dog with a hat?";

const textToImageKeywords = /\b(create|generate|make|draw|produce|design|build|show\s+me|visualize|imagine|picture\s+of|give\s+me\s+(a|an)|get\s+me\s+(a|an)|want\s+(a|an))\s+(an?|and|some|the)?\s*(image|picture|photo|illustration|artwork|visual|graphic|diagram)/i;

console.log('Testing query:', testQuery);
console.log('Pattern matches:', textToImageKeywords.test(testQuery));

if (textToImageKeywords.test(testQuery)) {
  console.log('✅ MATCH! Image generation would be triggered.');
} else {
  console.log('❌ NO MATCH. Would NOT trigger image generation.');
}
