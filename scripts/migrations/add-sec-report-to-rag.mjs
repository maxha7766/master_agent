/**
 * Add SEC Football Research Report to RAG
 * Manually adds the completed SEC football report to the RAG knowledge base
 * Uses direct database access and imported processor module
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';

// Load the document processor module from dist
import('./dist/services/documents/processor.js').then(async (module) => {
  const { documentProcessor } = module;

  config();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  async function addReportToRAG() {
    try {
      console.log('Fetching SEC football research project...');

      // Get the SEC football project
      const { data: project, error: projectError } = await supabase
        .from('research_projects')
        .select('*')
        .ilike('topic', '%sec football%')
        .eq('status', 'complete')
        .single();

      if (projectError || !project) {
        throw new Error(`Failed to find SEC football project: ${projectError?.message}`);
      }

      console.log('Found project:', {
        id: project.id,
        topic: project.topic,
        status: project.status,
        wordCount: project.final_word_count,
      });

      if (!project.final_report) {
        throw new Error('Project has no final report');
      }

      // Check if already added to RAG
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', project.user_id)
        .ilike('file_name', '%sec_football%')
        .single();

      if (existingDoc) {
        console.log('Report already exists in RAG:', existingDoc.id);
        return;
      }

      // Create document record
      const filename = `graduate_research_${project.topic.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.md`;
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

      // Process document for RAG (chunking, embeddings)
      console.log('Processing document for RAG...');

      await documentProcessor.processDocument(
        document.id,
        project.user_id,
        fileBuffer,
        'text/markdown'
      );

      // Update document status to completed
      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', document.id);

      console.log('✅ SEC football report successfully added to RAG!');
      console.log('Document ID:', document.id);
      console.log('You can now query it via chat');

    } catch (error) {
      console.error('❌ Failed to add report to RAG:', error);
      process.exit(1);
    }
  }

  await addReportToRAG();
}).catch((error) => {
  console.error('Failed to import documentProcessor:', error);
  process.exit(1);
});
