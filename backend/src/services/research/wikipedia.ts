/**
 * Wikipedia Search Service
 * Free, no API key required
 * Uses MediaWiki API for structured knowledge
 */

import { log } from '../../lib/logger.js';

export interface WikipediaResult {
  title: string;
  url: string;
  snippet: string;
  pageid: number;
}

export class WikipediaService {
  private baseUrl = 'https://en.wikipedia.org/w/api.php';

  async search(query: string, limit: number = 10): Promise<WikipediaResult[]> {
    try {
      // Search for pages
      const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(limit),
        format: 'json',
        origin: '*', // CORS
      });

      const response = await fetch(`${this.baseUrl}?${searchParams}`);

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.query?.search) {
        return [];
      }

      const results: WikipediaResult[] = data.query.search.map((item: any) => ({
        title: item.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        snippet: this.stripHtml(item.snippet),
        pageid: item.pageid,
      }));

      log.info('Wikipedia search successful', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('Wikipedia search failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  /**
   * Get full page content (summary)
   */
  async getPageSummary(title: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'extracts',
        exintro: 'true',
        explaintext: 'true',
        titles: title,
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      const pages = data.query?.pages;

      if (!pages) {
        return null;
      }

      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;

      return extract || null;
    } catch (error) {
      log.error('Wikipedia page summary failed', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });
      return null;
    }
  }

  /**
   * Remove HTML tags from snippet
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
