/**
 * Test Graduate Research System
 * Creates a research project and monitors its progress
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_PUBLIC;

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user credentials
const email = 'heath.maxwell@gmail.com';
const password = 'test1234';

async function testGraduateResearch() {
  console.log('🔐 Authenticating...');

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;
  console.log('✅ Authenticated as:', email);
  console.log('👤 User ID:', userId);

  // Create graduate research project
  console.log('\n📚 Creating graduate research project...');
  const createResponse = await fetch('http://localhost:3001/api/research/graduate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      topic: 'the history of SEC football',
      wordCountTarget: 7500,
      citationStyle: 'APA',
    }),
  });

  const createResult = await createResponse.json();

  if (!createResponse.ok) {
    console.error('❌ Failed to create project:', createResult);
    return;
  }

  console.log('✅ Project created:', createResult);
  const projectId = createResult.projectId;

  // Monitor progress
  console.log('\n⏳ Monitoring project progress...');
  console.log('This will take several minutes as the system:');
  console.log('  1. Gathers 12 sources from 5 APIs');
  console.log('  2. Analyzes sources to identify themes');
  console.log('  3. Writes 8 sections with LLM');
  console.log('  4. Formats citations and assembles report');

  let status = 'planning';
  let attempts = 0;
  const maxAttempts = 180; // 15 minutes max (5 second intervals)

  while (status !== 'complete' && status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    const statusResponse = await fetch(`http://localhost:3001/api/research/graduate/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const statusResult = await statusResponse.json();

    if (statusResponse.ok && statusResult.project) {
      const project = statusResult.project;
      status = project.status;

      console.log(`\n📊 Status: ${status.toUpperCase()}`);
      console.log(`   Sources: ${project.progress.sourcesGathered}`);
      console.log(`   Themes: ${project.progress.themesIdentified}`);
      console.log(`   Sections: ${project.progress.sectionsWritten}`);
      console.log(`   Words: ${project.progress.totalWordCount}`);
    }
  }

  if (status === 'complete') {
    console.log('\n✅ Research complete! Fetching final report...');

    const reportResponse = await fetch(`http://localhost:3001/api/research/graduate/${projectId}/report`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const reportResult = await reportResponse.json();

    if (reportResponse.ok && reportResult.report) {
      console.log('\n' + '='.repeat(80));
      console.log('FINAL REPORT');
      console.log('='.repeat(80));
      console.log(`Topic: ${reportResult.report.topic}`);
      console.log(`Word Count: ${reportResult.report.wordCount}`);
      console.log(`Citation Style: ${reportResult.report.citationStyle}`);
      console.log('='.repeat(80));
      console.log('\n' + reportResult.report.content);
      console.log('\n' + '='.repeat(80));
    } else {
      console.error('❌ Failed to fetch report:', reportResult);
    }
  } else if (status === 'failed') {
    console.error('❌ Research project failed');
  } else {
    console.error('⏱️  Timeout: Research took longer than 15 minutes');
  }
}

testGraduateResearch().catch(console.error);
