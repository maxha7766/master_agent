/**
 * Test Image Intent Detection
 */

const testQueries = [
  "can you make and image of a dog with a hat?",
  "create an image of a sunset",
  "generate a picture of a cat",
  "make an illustration of mountains",
  "what documents do I have?",
  "how many rows are in the data?",
];

function detectImageIntent(userQuery) {
  const query = userQuery.toLowerCase();

  // Text-to-image patterns
  const textToImageKeywords = /\b(create|generate|make|draw|produce|design|build|show\s+me|visualize|imagine|picture\s+of)\s+(an?|and|some|the)?\s*(image|picture|photo|illustration|artwork|visual|graphic|diagram)/i;
  const textToImageImplicit = /\b(create|generate|make|draw)\s+(?!.*\b(?:from|based on|using)\b.*\b(?:image|picture|photo)\b)/i;

  // Image editing patterns
  const imageEditKeywords = /\b(edit|modify|change|transform|alter|update)\s+(this|that|the|my)?\s*(image|picture|photo)/i;
  const imageToImageKeywords = /\b(based on|from|using)\s+(this|that|the|my)?\s*(image|picture|photo)/i;

  // Upscaling patterns
  const upscaleKeywords = /\b(upscale|enhance|enlarge|increase resolution|make.*bigger|improve quality)\s+(this|that|the|my)?\s*(image|picture|photo)?/i;

  // Variation patterns
  const variationKeywords = /\b(variation|variations|similar|different version|alternative)\s+(of|to)?\s*(this|that|the|my)?\s*(image|picture|photo)/i;

  // Inpainting patterns
  const inpaintKeywords = /\b(fill|fix|remove|replace|inpaint)\s+(this|that|the)?\s*(part|area|section|region)\s+(of|in)?\s*(the|this|that)?\s*(image|picture|photo)/i;

  // Check for image generation intent
  if (upscaleKeywords.test(query)) {
    return { isImageRequest: true, operation: 'upscale', reasoning: 'Upscale/enhancement keywords detected' };
  }

  if (variationKeywords.test(query)) {
    return { isImageRequest: true, operation: 'variation', reasoning: 'Variation keywords detected' };
  }

  if (inpaintKeywords.test(query)) {
    return { isImageRequest: true, operation: 'inpaint', reasoning: 'Inpainting keywords detected' };
  }

  if (imageEditKeywords.test(query) || imageToImageKeywords.test(query)) {
    return { isImageRequest: true, operation: 'image-to-image', reasoning: 'Image editing keywords detected' };
  }

  if (textToImageKeywords.test(query) || textToImageImplicit.test(query)) {
    return { isImageRequest: true, operation: 'text-to-image', reasoning: 'Image creation keywords detected' };
  }

  return { isImageRequest: false, operation: null, reasoning: 'No image generation intent detected' };
}

console.log('Testing Image Intent Detection:\n');

for (const query of testQueries) {
  const result = detectImageIntent(query);
  console.log(`Query: "${query}"`);
  console.log(`  → Image Request: ${result.isImageRequest ? '✓ YES' : '✗ NO'}`);
  console.log(`  → Operation: ${result.operation || 'N/A'}`);
  console.log(`  → Reasoning: ${result.reasoning}`);
  console.log('');
}
