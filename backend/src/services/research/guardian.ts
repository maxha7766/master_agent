/**
 * The Guardian API Service
 * High-quality journalism and news from The Guardian
 * Requires API key: https://open-platform.theguardian.com/
 */

import { log } from '../../lib/logger.js';

export interface GuardianResult {
  title: string;
  url: string;
  snippet: string;
  section: string;
  publishedAt: Date;
  type: string; // article, liveblog, video, etc.
}

export class GuardianService {
  private apiKey: string;
  private baseUrl = 'https://content.guardianapis.com';

  constructor() {
    const key = process.env.GUARDIAN_API_KEY;
    if (!key) {
      throw new Error('GUARDIAN_API_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  async search(
    query: string,
    options: {
      limit?: number;
      section?: string; // e.g., 'world', 'business', 'technology'
      orderBy?: 'newest' | 'oldest' | 'relevance';
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<GuardianResult[]> {
    try {
      const {
        limit = 10,
        section,
        orderBy = 'relevance',
        fromDate,
        toDate,
      } = options;

      const params = new URLSearchParams({
        q: query,
        'api-key': this.apiKey,
        'show-fields': 'trailText,bodyText',
        'page-size': String(Math.min(limit, 50)), // API max is 50
        'order-by': orderBy,
      });

      if (section) {
        params.append('section', section);
      }

      if (fromDate) {
        params.append('from-date', fromDate.toISOString().split('T')[0]);
      }

      if (toDate) {
        params.append('to-date', toDate.toISOString().split('T')[0]);
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`);

      if (!response.ok) {
        throw new Error(`Guardian API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (data.response?.status !== 'ok') {
        throw new Error(`Guardian API error: ${data.response?.message || 'Unknown error'}`);
      }

      const results: GuardianResult[] = ((data.response.results || []) as any[]).map((item: any) => ({
        title: item.webTitle,
        url: item.webUrl,
        snippet: item.fields?.trailText || '',
        section: item.sectionName,
        publishedAt: new Date(item.webPublicationDate),
        type: item.type,
      }));

      log.info('Guardian API search successful', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('Guardian API search failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  /**
   * Get content by section (e.g., world news, business, technology)
   */
  async getBySection(
    section: string,
    options: {
      limit?: number;
      orderBy?: 'newest' | 'oldest' | 'relevance';
    } = {}
  ): Promise<GuardianResult[]> {
    try {
      const { limit = 10, orderBy = 'newest' } = options;

      const params = new URLSearchParams({
        'api-key': this.apiKey,
        'show-fields': 'trailText',
        'page-size': String(Math.min(limit, 50)),
        'order-by': orderBy,
      });

      const response = await fetch(`${this.baseUrl}/${section}?${params}`);

      if (!response.ok) {
        throw new Error(`Guardian API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (data.response?.status !== 'ok') {
        throw new Error(`Guardian API error: ${data.response?.message || 'Unknown error'}`);
      }

      const results: GuardianResult[] = ((data.response.results || []) as any[]).map((item: any) => ({
        title: item.webTitle,
        url: item.webUrl,
        snippet: item.fields?.trailText || '',
        section: item.sectionName,
        publishedAt: new Date(item.webPublicationDate),
        type: item.type,
      }));

      log.info('Guardian API section fetch successful', {
        section,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('Guardian API section fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        section,
      });
      throw error;
    }
  }
}
