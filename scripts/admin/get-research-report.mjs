#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

console.log('=== MARKDOWN REPORT: THE HISTORY OF SEC FOOTBALL ===\n');
chunks.forEach(chunk => {
  console.log(chunk.content);
  console.log('\n');
});

process.exit(0);
