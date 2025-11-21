/**
 * Web Documentation Scraper
 * Specialized service for scraping structured documentation sources (Excel, etc.)
 * Uses Firecrawl for clean markdown extraction
 */

import { FirecrawlService } from '../research/firecrawl.js';
import { log } from '../../lib/logger.js';
import type { ExcelDocSource } from '../../config/excel-sources.js';

export interface ScrapedDocument {
  title: string;
  content: string;
  url: string;
  sourceMetadata: {
    source_type: 'microsoft_docs' | 'third_party';
    doc_category: string;
    excel_version?: string[];
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    function_category?: string;
    use_cases?: string[];
    provider?: string;
    scraped_at: string;
  };
}

export class WebDocScraper {
  private firecrawl: FirecrawlService;

  constructor() {
    this.firecrawl = new FirecrawlService();
  }

  /**
   * Scrape single documentation page using Firecrawl
   */
  async scrapeDocPage(source: ExcelDocSource): Promise<ScrapedDocument | null> {
    log.info('Scraping documentation page', {
      name: source.name,
      url: source.url,
    });

    const result = await this.firecrawl.extractContent(source.url);

    if (!result.success || !result.content) {
      log.warn('Failed to scrape documentation', { url: source.url });
      return null;
    }

    return {
      title: result.title || source.name,
      content: result.content,
      url: source.url,
      sourceMetadata: {
        source_type: source.metadata.source_type,
        doc_category: source.metadata.doc_category,
        excel_version: source.metadata.excel_version,
        difficulty_level: source.metadata.difficulty_level,
        function_category: source.metadata.function_category,
        use_cases: source.metadata.use_cases,
        provider: source.metadata.provider,
        scraped_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Scrape multiple documentation sources with rate limiting
   */
  async scrapeMultipleSources(
    sources: ExcelDocSource[]
  ): Promise<Map<string, ScrapedDocument>> {
    const results = new Map<string, ScrapedDocument>();

    log.info('Starting batch scraping', { count: sources.length });

    for (const source of sources) {
      try {
        const doc = await this.scrapeDocPage(source);

        if (doc) {
          results.set(source.id, doc);
          log.info('Successfully scraped source', {
            id: source.id,
            name: source.name,
            contentLength: doc.content.length,
          });
        }

        // Rate limiting: wait 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        log.error('Failed to scrape source', {
          id: source.id,
          name: source.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    log.info('Batch scraping completed', {
      total: sources.length,
      successful: results.size,
      failed: sources.length - results.size,
    });

    return results;
  }

  /**
   * Scrape and segment a single page by sections (for category-based docs)
   * Useful for "Functions by Category" where one page has multiple sections
   */
  async scrapeAndSegmentByCategory(
    source: ExcelDocSource
  ): Promise<Map<string, ScrapedDocument>> {
    const results = new Map<string, ScrapedDocument>();

    // First scrape the full page
    const fullDoc = await this.scrapeDocPage(source);
    if (!fullDoc) {
      return results;
    }

    // If this is a category-based document, segment by categories
    const categories = source.metadata.categories || [];
    if (categories.length === 0) {
      // Not a category-based doc, return as single document
      results.set(source.id, fullDoc);
      return results;
    }

    // Segment the content by markdown headers (## Category Name)
    const sections = this.segmentByHeaders(fullDoc.content);

    // Create separate documents for each category
    let categoryIndex = 0;
    for (const [sectionTitle, sectionContent] of sections.entries()) {
      // Try to match section title to one of our known categories
      const matchedCategory = categories.find((cat) =>
        sectionTitle.toLowerCase().includes(cat.toLowerCase())
      );

      if (matchedCategory || sections.size === 1) {
        const categoryDoc: ScrapedDocument = {
          title: sectionTitle || `${source.name} - Section ${categoryIndex + 1}`,
          content: sectionContent,
          url: fullDoc.url,
          sourceMetadata: {
            ...fullDoc.sourceMetadata,
            function_category: matchedCategory || sectionTitle,
          },
        };

        const categoryId = `${source.id}-${categoryIndex}`;
        results.set(categoryId, categoryDoc);
        categoryIndex++;

        log.info('Created category segment', {
          sourceId: source.id,
          category: matchedCategory || sectionTitle,
          contentLength: sectionContent.length,
        });
      }
    }

    // If no segments were created, use the full document
    if (results.size === 0) {
      results.set(source.id, fullDoc);
    }

    return results;
  }

  /**
   * Segment markdown content by headers (## Header)
   * Returns a map of header text to content
   */
  private segmentByHeaders(markdown: string): Map<string, string> {
    const segments = new Map<string, string>();

    // Split by level 2 headers (##)
    const headerRegex = /^##\s+(.+)$/gm;
    const matches = [...markdown.matchAll(headerRegex)];

    if (matches.length === 0) {
      // No headers found, return entire content
      segments.set('Main Content', markdown);
      return segments;
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headerText = match[1].trim();
      const startIndex = match.index! + match[0].length;

      // Content is from after this header until the next header (or end of document)
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : markdown.length;
      const content = markdown.substring(startIndex, endIndex).trim();

      if (content.length > 100) {
        // Only include substantial segments
        segments.set(headerText, `## ${headerText}\n\n${content}`);
      }
    }

    return segments;
  }

  /**
   * Validate scraped content quality
   * Returns true if content appears to be valid Excel documentation
   */
  validateContent(content: string): boolean {
    // Check minimum length
    if (content.length < 500) {
      return false;
    }

    // Check for Excel-specific keywords
    const excelKeywords = [
      'excel',
      'function',
      'formula',
      'cell',
      'worksheet',
      'workbook',
      'syntax',
      'argument',
    ];

    const lowerContent = content.toLowerCase();
    const keywordMatches = excelKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    );

    // At least 3 Excel keywords should be present
    return keywordMatches.length >= 3;
  }
}
