#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const documentId = '7c1f4911-65aa-4572-a4a1-8d816c112607';

// Get chunks
const { data: chunks, error } = await supabase
  .from('chunks')
  .select('content, chunk_index')
  .eq('document_id', documentId)
  .order('chunk_index');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

// Concatenate all chunks
const fullMarkdown = chunks.map(c => c.content).join('\n');

// Save to file
fs.writeFileSync('sec_football_research.md', fullMarkdown);
console.log('✅ Saved full markdown to sec_football_research.md');
console.log(`   Total length: ${fullMarkdown.length} characters`);
console.log(`   Chunks: ${chunks.length}`);

// Also print to console
console.log('\n' + '='.repeat(80));
console.log(fullMarkdown);
console.log('='.repeat(80));

process.exit(0);
