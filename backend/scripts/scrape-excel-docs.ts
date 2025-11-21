/**
 * Excel Documentation Scraping Script
 * Scrapes all configured Excel documentation sources and saves them locally
 *
 * Usage: npm run scrape-excel-docs
 */

import { WebDocScraper } from '../src/services/documents/web-scraper.js';
import { EXCEL_DOC_SOURCES } from '../src/config/excel-sources.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🔥 Excel Documentation Scraping');
  console.log('================================\n');

  const scraper = new WebDocScraper();
  const outputDir = path.join(__dirname, '..', 'data', 'excel-docs');

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`📁 Output directory: ${outputDir}\n`);

  const allDocuments = new Map<string, any>();
  let totalDocuments = 0;
  let failedSources = 0;

  for (const source of EXCEL_DOC_SOURCES) {
    console.log(`\n📥 Scraping: ${source.name}`);
    console.log(`   URL: ${source.url}`);
    console.log(`   Strategy: ${source.metadata.scraping_strategy || 'single_page'}\n`);

    try {
      let docs: Map<string, any>;

      // Use different scraping strategy based on configuration
      if (source.metadata.scraping_strategy === 'single_page_segmented') {
        docs = await scraper.scrapeAndSegmentByCategory(source);
      } else {
        const doc = await scraper.scrapeDocPage(source);
        docs = new Map();
        if (doc) {
          docs.set(source.id, doc);
        }
      }

      if (docs.size === 0) {
        console.log(`   ❌ No content scraped`);
        failedSources++;
        continue;
      }

      // Validate content quality
      let validDocs = 0;
      for (const [docId, doc] of docs.entries()) {
        if (scraper.validateContent(doc.content)) {
          allDocuments.set(docId, doc);
          validDocs++;
          totalDocuments++;
        }
      }

      console.log(`   ✅ Scraped ${docs.size} document(s) (${validDocs} valid)`);

      // Save individual source file
      const sourceData = Array.from(docs.values());
      await fs.writeFile(
        path.join(outputDir, `${source.id}.json`),
        JSON.stringify(sourceData, null, 2),
        'utf-8'
      );

      console.log(`   💾 Saved to ${source.id}.json`);
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      failedSources++;
    }
  }

  // Save combined file with all documents
  const combinedData = Array.from(allDocuments.values());
  await fs.writeFile(
    path.join(outputDir, '_all-excel-docs.json'),
    JSON.stringify(combinedData, null, 2),
    'utf-8'
  );

  // Generate summary report
  const summary = {
    scrapedAt: new Date().toISOString(),
    totalSources: EXCEL_DOC_SOURCES.length,
    successfulSources: EXCEL_DOC_SOURCES.length - failedSources,
    failedSources,
    totalDocuments,
    documents: combinedData.map((doc) => ({
      title: doc.title,
      url: doc.url,
      contentLength: doc.content.length,
      sourceType: doc.sourceMetadata.source_type,
      category: doc.sourceMetadata.doc_category,
    })),
  };

  await fs.writeFile(
    path.join(outputDir, '_scraping-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  // Print final summary
  console.log('\n\n📊 Scraping Summary');
  console.log('===================');
  console.log(`Total sources configured: ${EXCEL_DOC_SOURCES.length}`);
  console.log(`Successful: ${EXCEL_DOC_SOURCES.length - failedSources}`);
  console.log(`Failed: ${failedSources}`);
  console.log(`Total documents: ${totalDocuments}`);
  console.log(`\n💾 All files saved to: ${outputDir}`);
  console.log('\n✅ Scraping complete!');
  console.log('\nNext step: Run "npm run ingest-excel-docs <user-id>" to import into RAG system');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
