import { PDFParse } from 'pdf-parse';

// Test with actual PDF URL from the docs
console.log('Testing PDF parse with bitcoin whitepaper...');

try {
  const parser = new PDFParse({ url: 'https://bitcoin.org/bitcoin.pdf' });
  const result = await parser.getText();
  console.log('Success! Extracted', result.text.length, 'characters');
  console.log('First 100 chars:', result.text.substring(0, 100));
} catch (error) {
  console.log('Error:', error.message);
}
