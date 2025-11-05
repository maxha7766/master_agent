/**
 * Tavily Search Service
 * Advanced web search API for topic research
 */
import { log } from '../../lib/logger.js';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number; // 0-1
  published_date?: string;
  raw_content?: string;
}

export class TavilySearchService {
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
  }

  async search(query: string, numResults: number = 10): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      log.warn('Tavily API key not configured');
      return [];
    }

    try {
      log.info('Tavily search started', { query, numResults });

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: 'advanced',
          max_results: numResults,
          include_answer: false,
          include_raw_content: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = (await response.json()) as { results?: any[] };

      const results = (data.results || []).map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url,
        content: result.content || result.snippet || '',
        score: result.score || 0.5,
        published_date: result.published_date,
        raw_content: result.raw_content,
      }));

      log.info('Tavily search completed', { resultsFound: results.length });
      return results;
    } catch (error) {
      log.error('Tavily search failed', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      return [];
    }
  }
}
