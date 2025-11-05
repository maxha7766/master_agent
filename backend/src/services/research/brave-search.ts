/**
 * Brave Search Service
 * Web search API for topic research
 */
import { log } from '../../lib/logger.js';

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export class BraveSearchService {
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY;
  }

  async search(query: string, numResults: number = 10): Promise<BraveSearchResult[]> {
    if (!this.apiKey) {
      log.warn('Brave API key not configured');
      return [];
    }

    try {
      log.info('Brave search started', { query, numResults });

      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(Math.min(numResults, 20)));

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.status}`);
      }

      const data = (await response.json()) as { web?: { results?: any[] } };

      const results = (data.web?.results || []).map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url,
        description: result.description || '',
        age: result.age,
      }));

      log.info('Brave search completed', { resultsFound: results.length });
      return results;
    } catch (error) {
      log.error('Brave search failed', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      return [];
    }
  }
}
