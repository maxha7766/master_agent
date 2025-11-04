/**
 * Add SEC Football Research Report to RAG (Simple Version)
 * Manually adds the completed SEC football report to the RAG knowledge base
 * Uses direct Supabase calls and Cohere embeddings
 */

import { createClient } from '@supabase/supabase-js';
import { CohereClientV2 } from 'cohere-ai';
import { config } from 'dotenv';
import crypto from 'crypto';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY,
});

async function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let chunkNumber = 0;

  for (const line of lines) {
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunk_number: chunkNumber++,
      });
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      chunk_number: chunkNumber,
    });
  }

  return chunks;
}

async function generateEmbedding(text) {
  try {
    const response = await cohere.embed({
      texts: [text],
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });
    return response.embeddings.float[0];
  } catch (error) {
    console.error('Embedding generation failed:', error.message);
    throw error;
  }
}

async function addReportToRAG() {
  try {
    console.log('Fetching SEC football research projects...');

    // List all SEC football projects
    const { data: allProjects, error: listError } = await supabase
      .from('research_projects')
      .select('*')
      .ilike('topic', '%sec football%')
      .order('created_at', { ascending: false });

    if (listError) {
      throw new Error(`Failed to list projects: ${listError.message}`);
    }

    console.log(`Found ${allProjects?.length || 0} SEC football projects`);
    allProjects?.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.topic} (${p.status}) - ${p.final_word_count || 0} words`);
    });

    // Get the most recent completed one
    const project = allProjects?.find(p => p.status === 'complete' && p.final_report);

    if (!project) {
      throw new Error('No completed SEC football project found with final report');
    }

    console.log('\nUsing project:', {
      id: project.id,
      topic: project.topic,
      status: project.status,
      wordCount: project.final_word_count,
    });

    // Check if already added to RAG
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', project.user_id)
      .ilike('file_name', '%sec%football%')
      .maybeSingle();

    if (existingDoc) {
      console.log('Report already exists in RAG:', existingDoc.id);
      console.log('Skipping upload.');
      return;
    }

    // Create document record
    const filename = `graduate_research_SEC_Football_History_Traditions_and_Rivalries.md`;
    const fileBuffer = Buffer.from(project.final_report, 'utf-8');
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log('Creating document record...');

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: project.user_id,
        file_name: filename,
        file_type: 'text/markdown',
        file_size: fileBuffer.length,
        file_url: '',
        content_hash: contentHash,
        status: 'processing',
        title: 'SEC Football History, Traditions, and Rivalries',
      })
      .select()
      .single();

    if (docError || !document) {
      throw new Error(`Failed to create document: ${docError?.message}`);
    }

    console.log('Document created:', {
      id: document.id,
      filename: document.file_name,
      size: document.file_size,
    });

    // Chunk the report
    console.log('Chunking document...');
    const chunks = await chunkText(project.final_report, 1000);
    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings and insert chunks
    console.log('Generating embeddings and inserting chunks...');
    console.log('(Rate limited to 30 requests/minute to avoid Cohere trial limits)');
    let processedChunks = 0;

    // Check if document already has some chunks (resume capability)
    const { data: existingChunks } = await supabase
      .from('chunks')
      .select('position')
      .eq('document_id', document.id)
      .order('position', { ascending: false })
      .limit(1);

    const startChunk = existingChunks && existingChunks.length > 0
      ? existingChunks[0].position + 1
      : 0;

    if (startChunk > 0) {
      console.log(`Resuming from chunk ${startChunk} (${startChunk} chunks already processed)`);
      processedChunks = startChunk;
    }

    for (let i = startChunk; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await generateEmbedding(chunk.content);

        await supabase.from('chunks').insert({
          document_id: document.id,
          user_id: project.user_id,
          content: chunk.content,
          position: chunk.chunk_number,
          embedding,
          metadata: {},
        });

        processedChunks++;

        if (processedChunks % 10 === 0) {
          console.log(`Processed ${processedChunks}/${chunks.length} chunks...`);
        }

        // Rate limit: 30 requests per minute = 2000ms per request
        // This is slower than 40/min to be safe
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2100));
        }
      } catch (error) {
        console.error(`Failed to process chunk ${chunk.chunk_number}:`, error.message);
        console.log(`\nProcessed ${processedChunks}/${chunks.length} chunks before error.`);
        console.log('You can run this script again to resume from where it left off.');
        throw error;
      }
    }

    // Update document status and chunk count
    await supabase
      .from('documents')
      .update({
        status: 'completed',
        chunk_count: chunks.length,
      })
      .eq('id', document.id);

    console.log('✅ SEC football report successfully added to RAG!');
    console.log('Document ID:', document.id);
    console.log('Chunks created:', chunks.length);
    console.log('You can now query it via chat');

  } catch (error) {
    console.error('❌ Failed to add report to RAG:', error);
    process.exit(1);
  }
}

addReportToRAG();
