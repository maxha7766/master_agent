/**
 * Multi-Search Coordinator
 * Tries search engines sequentially: DuckDuckGo → Brave → Tavily
 * Deduplicates and ranks results
 */
import { DuckDuckGoService } from './duckduckgo.js';
import { BraveSearchService } from './brave-search.js';
import { TavilySearchService } from './tavily-search.js';
import { log } from '../../lib/logger.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'brave' | 'tavily';
  score: number; // 0-10
  publishDate?: Date;
  author?: string;
}

export class MultiSearchService {
  private ddg = new DuckDuckGoService();
  private brave = new BraveSearchService();
  private tavily = new TavilySearchService();

  async searchWithFallback(
    query: string,
    numResults: number
  ): Promise<{ results: SearchResult[], enginesUsed: string[] }> {
    const enginesUsed: string[] = [];
    let results: SearchResult[] = [];

    // Try DuckDuckGo first (free)
    try {
      const ddgResults = await this.ddg.search(query, numResults);
      if (ddgResults.length > 0) {
        results = ddgResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
          source: 'duckduckgo' as const,
          score: this.scoreByDomain(r.url),
        }));
        enginesUsed.push('duckduckgo');
        log.info('DuckDuckGo search succeeded', { count: results.length });
      }
    } catch (error) {
      log.warn('DuckDuckGo failed, trying Brave', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Fallback to Brave if needed (less than 50% of requested results)
    if (results.length < numResults * 0.5) {
      try {
        const braveResults = await this.brave.search(query, numResults);
        if (braveResults.length > 0) {
          const braveFormatted = braveResults.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
            source: 'brave' as const,
            score: this.scoreByDomain(r.url),
          }));
          results = [...results, ...braveFormatted];
          enginesUsed.push('brave');
          log.info('Brave search succeeded', { count: braveResults.length });
        }
      } catch (error) {
        log.warn('Brave failed, trying Tavily', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Fallback to Tavily as last resort
    if (results.length < numResults * 0.5) {
      try {
        const tavilyResults = await this.tavily.search(query, numResults);
        if (tavilyResults.length > 0) {
          const tavilyFormatted = tavilyResults.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            source: 'tavily' as const,
            score: r.score * 10, // Tavily score is 0-1, normalize to 0-10
            publishDate: r.published_date ? new Date(r.published_date) : undefined,
          }));
          results = [...results, ...tavilyFormatted];
          enginesUsed.push('tavily');
          log.info('Tavily search succeeded', { count: tavilyResults.length });
        }
      } catch (error) {
        log.error('All search engines failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Deduplicate by URL similarity
    results = this.deduplicateResults(results);

    // Rank and return top N
    results.sort((a, b) => b.score - a.score);

    log.info('Multi-search completed', {
      totalResults: results.length,
      enginesUsed,
      topN: numResults
    });

    return {
      results: results.slice(0, numResults),
      enginesUsed,
    };
  }

  /**
   * Score web sources by domain quality
   */
  private scoreByDomain(url: string): number {
    try {
      const domain = new URL(url).hostname.toLowerCase();

      // High-quality domains (9-10)
      if (domain.endsWith('.edu')) return 9;
      if (domain.endsWith('.gov')) return 9;
      if (domain.includes('wikipedia.org')) return 8;
      if (domain.includes('nytimes.com')) return 8;
      if (domain.includes('reuters.com')) return 8;
      if (domain.includes('bbc.com')) return 8;
      if (domain.includes('nature.com')) return 9;
      if (domain.includes('sciencedirect.com')) return 8;

      // Medium-quality domains (6-7)
      if (domain.endsWith('.org')) return 7;
      if (domain.includes('forbes.com')) return 7;
      if (domain.includes('wsj.com')) return 7;
      if (domain.includes('harvard.edu')) return 9;
      if (domain.includes('stanford.edu')) return 9;
      if (domain.includes('mit.edu')) return 9;

      // Default score for other sources
      return 6;
    } catch {
      return 5; // Invalid URL
    }
  }

  /**
   * Deduplicate results by URL similarity
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      try {
        const url = new URL(r.url);
        const normalized = url.hostname + url.pathname;
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      } catch {
        return true; // Keep if URL is invalid
      }
    });
  }
}
