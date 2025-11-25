/**
 * News API Service
 * Aggregates news from 80,000+ sources worldwide
 * Requires API key: https://newsapi.org/
 */

import { log } from '../../lib/logger.js';

export interface NewsAPIResult {
  title: string;
  description: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: Date;
  content?: string;
}

export class NewsAPIService {
  private apiKey: string;
  private baseUrl = 'https://newsapi.org/v2';

  constructor() {
    const key = process.env.NEWSAPI_KEY;
    if (!key) {
      throw new Error('NEWSAPI_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  /**
   * Search everything - articles from all sources
   */
  async searchEverything(
    query: string,
    options: {
      limit?: number;
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
      from?: Date;
      to?: Date;
    } = {}
  ): Promise<NewsAPIResult[]> {
    try {
      const {
        limit = 10,
        language = 'en',
        sortBy = 'relevancy',
        from,
        to,
      } = options;

      const params = new URLSearchParams({
        q: query,
        language,
        sortBy,
        pageSize: String(Math.min(limit, 100)), // API max is 100
        apiKey: this.apiKey,
      });

      if (from) {
        params.append('from', from.toISOString());
      }

      if (to) {
        params.append('to', to.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/everything?${params}`);

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`NewsAPI error: ${error.message || response.statusText}`);
      }

      const data = await response.json() as any;

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
      }

      const results: NewsAPIResult[] = ((data.articles || []) as any[]).map((article: any) => ({
        title: article.title || 'No title',
        description: article.description || '',
        url: article.url,
        source: article.source?.name || 'Unknown',
        author: article.author,
        publishedAt: new Date(article.publishedAt),
        content: article.content,
      }));

      log.info('NewsAPI search successful', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('NewsAPI search failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  /**
   * Get top headlines from specific sources or categories
   */
  async getTopHeadlines(
    options: {
      category?: 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
      country?: string; // 2-letter ISO code
      sources?: string; // Comma-separated source IDs
      query?: string;
      limit?: number;
    } = {}
  ): Promise<NewsAPIResult[]> {
    try {
      const { category, country = 'us', sources, query, limit = 10 } = options;

      const params = new URLSearchParams({
        pageSize: String(Math.min(limit, 100)),
        apiKey: this.apiKey,
      });

      if (query) params.append('q', query);
      if (category) params.append('category', category);
      if (sources) params.append('sources', sources);
      else params.append('country', country); // Can't use country with sources

      const response = await fetch(`${this.baseUrl}/top-headlines?${params}`);

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`NewsAPI error: ${error.message || response.statusText}`);
      }

      const data = await response.json() as any;

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
      }

      const results: NewsAPIResult[] = ((data.articles || []) as any[]).map((article: any) => ({
        title: article.title || 'No title',
        description: article.description || '',
        url: article.url,
        source: article.source?.name || 'Unknown',
        author: article.author,
        publishedAt: new Date(article.publishedAt),
        content: article.content,
      }));

      log.info('NewsAPI top headlines successful', {
        category,
        country,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('NewsAPI top headlines failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
