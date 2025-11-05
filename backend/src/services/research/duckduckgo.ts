/**
 * DuckDuckGo Search Service
 * Free web search with no API key required
 */
import { search, SafeSearchType } from 'duck-duck-scrape';
import { log } from '../../lib/logger.js';

export interface DDGSearchResult {
  title: string;
  url: string;
  description: string;
  hostname?: string;
}

export class DuckDuckGoService {
  async search(query: string, numResults: number = 10): Promise<DDGSearchResult[]> {
    try {
      log.info('DuckDuckGo search started', { query, numResults });

      const results = await search(query, {
        safeSearch: SafeSearchType.MODERATE,
      });

      const formatted = results.results
        .slice(0, numResults)
        .map(r => ({
          title: r.title,
          url: r.url,
          description: r.description,
          hostname: r.hostname,
        }));

      log.info('DuckDuckGo search completed', { resultsFound: formatted.length });
      return formatted;
    } catch (error) {
      log.error('DuckDuckGo search failed', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      return [];
    }
  }
}
