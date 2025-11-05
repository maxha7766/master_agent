/**
 * Firecrawl Content Extraction Service
 * Extracts clean markdown from URLs
 */
import FirecrawlApp from '@mendable/firecrawl-js';
import { log } from '../../lib/logger.js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export interface ExtractionResult {
  content: string;
  title: string;
  success: boolean;
}

export class FirecrawlService {
  private app?: FirecrawlApp;

  constructor() {
    if (FIRECRAWL_API_KEY) {
      this.app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });
    } else {
      log.warn('FIRECRAWL_API_KEY not set, content extraction will be limited');
    }
  }

  async extractContent(url: string): Promise<ExtractionResult> {
    if (!this.app) {
      return { content: '', title: '', success: false };
    }

    try {
      log.info('Firecrawl extraction started', { url });

      const result = await this.app.scrapeUrl(url, {
        formats: ['markdown'],
        timeout: 30000,
        onlyMainContent: true,
      });

      if (result.success && result.markdown) {
        log.info('Firecrawl extraction succeeded', {
          url,
          contentLength: result.markdown.length
        });

        return {
          content: result.markdown,
          title: result.metadata?.title || 'Untitled',
          success: true,
        };
      }

      log.warn('Firecrawl extraction returned no content', { url });
      return { content: '', title: '', success: false };
    } catch (error) {
      log.error('Firecrawl extraction failed', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return { content: '', title: '', success: false };
    }
  }

  async extractMultiple(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    log.info('Firecrawl batch extraction started', { count: urls.length });

    for (const url of urls) {
      const { content, success } = await this.extractContent(url);
      if (success && content) {
        results.set(url, content);
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log.info('Firecrawl batch extraction completed', {
      total: urls.length,
      successful: results.size
    });

    return results;
  }
}
