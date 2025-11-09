/**
 * Enhanced Multi-Search Coordinator
 * Intelligently routes queries to appropriate search sources based on query type
 * - General web: DuckDuckGo → Brave → Tavily
 * - Knowledge/Facts: Wikipedia
 * - News/Current Events: News API + Guardian
 * - Economic Data: FRED
 * - Financial/Stock Data: Alpha Vantage
 * Deduplicates and ranks results from all sources
 */

import { DuckDuckGoService } from './duckduckgo.js';
import { BraveSearchService } from './brave-search.js';
import { TavilySearchService } from './tavily-search.js';
import { WikipediaService } from './wikipedia.js';
import { NewsAPIService } from './newsapi.js';
import { GuardianService } from './guardian.js';
import { FREDService } from './fred.js';
import { AlphaVantageService } from './alpha-vantage.js';
import { log } from '../../lib/logger.js';

export interface EnhancedSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'brave' | 'tavily' | 'wikipedia' | 'newsapi' | 'guardian' | 'fred' | 'alphavantage';
  score: number; // 0-10
  publishDate?: Date;
  author?: string;
}

type QueryType = 'general' | 'news' | 'knowledge' | 'economic' | 'financial';

export class EnhancedMultiSearchService {
  // Web search engines
  private ddg = new DuckDuckGoService();
  private brave = new BraveSearchService();
  private tavily = new TavilySearchService();

  // Specialized sources
  private wikipedia = new WikipediaService();
  private newsAPI = new NewsAPIService();
  private guardian = new GuardianService();
  private fred = new FREDService();
  private alphaVantage = new AlphaVantageService();

  /**
   * Intelligent search that routes to appropriate sources
   */
  async search(
    query: string,
    options: {
      numResults?: number;
      queryType?: QueryType;
    } = {}
  ): Promise<{ results: EnhancedSearchResult[], sourcesUsed: string[] }> {
    const { numResults = 10, queryType } = options;

    // Auto-detect query type if not specified
    const detectedType = queryType || this.detectQueryType(query);

    log.info('Enhanced search initiated', { query, queryType: detectedType });

    const sourcesUsed: string[] = [];
    let results: EnhancedSearchResult[] = [];

    // Route to appropriate sources based on query type
    switch (detectedType) {
      case 'news':
        results = await this.searchNews(query, numResults, sourcesUsed);
        break;

      case 'knowledge':
        results = await this.searchKnowledge(query, numResults, sourcesUsed);
        break;

      case 'economic':
        results = await this.searchEconomic(query, numResults, sourcesUsed);
        break;

      case 'financial':
        results = await this.searchFinancial(query, numResults, sourcesUsed);
        break;

      case 'general':
      default:
        results = await this.searchGeneral(query, numResults, sourcesUsed);
        break;
    }

    // Always add Wikipedia for context (if not already included)
    if (!sourcesUsed.includes('wikipedia') && detectedType !== 'knowledge') {
      try {
        const wikiResults = await this.fetchWikipedia(query, Math.min(2, numResults));
        results = [...results, ...wikiResults];
        sourcesUsed.push('wikipedia');
      } catch (error) {
        log.warn('Wikipedia fetch failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Deduplicate and rank
    results = this.deduplicateResults(results);
    results.sort((a, b) => b.score - a.score);

    log.info('Enhanced search completed', {
      totalResults: results.length,
      sourcesUsed,
      queryType: detectedType,
    });

    return {
      results: results.slice(0, numResults),
      sourcesUsed,
    };
  }

  /**
   * Search for news and current events
   */
  private async searchNews(query: string, numResults: number, sourcesUsed: string[]): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[] = [];

    // Try News API first
    try {
      const newsResults = await this.newsAPI.searchEverything(query, { limit: Math.ceil(numResults / 2) });
      results = newsResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        source: 'newsapi' as const,
        score: 8, // High score for news relevance
        publishDate: r.publishedAt,
        author: r.author,
      }));
      sourcesUsed.push('newsapi');
      log.info('News API search succeeded', { count: results.length });
    } catch (error) {
      log.warn('News API failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Add Guardian for quality journalism
    try {
      const guardianResults = await this.guardian.search(query, { limit: Math.ceil(numResults / 2) });
      const guardianFormatted = guardianResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: 'guardian' as const,
        score: 8.5, // Slightly higher for quality journalism
        publishDate: r.publishedAt,
      }));
      results = [...results, ...guardianFormatted];
      sourcesUsed.push('guardian');
      log.info('Guardian search succeeded', { count: guardianResults.length });
    } catch (error) {
      log.warn('Guardian failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Fallback to general web search if needed
    if (results.length < numResults * 0.3) {
      const generalResults = await this.searchGeneral(query, numResults, sourcesUsed);
      results = [...results, ...generalResults];
    }

    return results;
  }

  /**
   * Search for knowledge and facts
   */
  private async searchKnowledge(query: string, numResults: number, sourcesUsed: string[]): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[] = [];

    // Wikipedia as primary source for knowledge
    const wikiResults = await this.fetchWikipedia(query, numResults);
    results = [...results, ...wikiResults];
    sourcesUsed.push('wikipedia');

    // Supplement with general web search
    if (results.length < numResults * 0.5) {
      const generalResults = await this.searchGeneral(query, numResults - results.length, sourcesUsed);
      results = [...results, ...generalResults];
    }

    return results;
  }

  /**
   * Search for economic data
   */
  private async searchEconomic(query: string, numResults: number, sourcesUsed: string[]): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[] = [];

    // Try FRED for economic data
    try {
      const fredResults = await this.fred.searchSeries(query, { limit: Math.ceil(numResults / 2) });
      results = fredResults.map(r => ({
        title: r.title,
        url: `https://fred.stlouisfed.org/series/${r.id}`,
        snippet: r.notes,
        source: 'fred' as const,
        score: 9, // High score for economic data relevance
        publishDate: r.lastUpdated,
      }));
      sourcesUsed.push('fred');
      log.info('FRED search succeeded', { count: results.length });
    } catch (error) {
      log.warn('FRED failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Supplement with general web search
    const generalResults = await this.searchGeneral(query, numResults - results.length, sourcesUsed);
    results = [...results, ...generalResults];

    return results;
  }

  /**
   * Search for financial/stock data
   */
  private async searchFinancial(query: string, numResults: number, sourcesUsed: string[]): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[] = [];

    // Try Alpha Vantage for stock symbols
    try {
      const symbols = await this.alphaVantage.searchSymbols(query);
      results = symbols.slice(0, Math.ceil(numResults / 3)).map(s => ({
        title: `${s.symbol}: ${s.name}`,
        url: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${s.symbol}`,
        snippet: `${s.type} - ${s.region}`,
        source: 'alphavantage' as const,
        score: 8.5,
      }));
      sourcesUsed.push('alphavantage');
      log.info('Alpha Vantage search succeeded', { count: results.length });
    } catch (error) {
      log.warn('Alpha Vantage failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Supplement with general web search
    const generalResults = await this.searchGeneral(query, numResults - results.length, sourcesUsed);
    results = [...results, ...generalResults];

    return results;
  }

  /**
   * General web search with fallback chain
   */
  private async searchGeneral(query: string, numResults: number, sourcesUsed: string[]): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[] = [];

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
        sourcesUsed.push('duckduckgo');
        log.info('DuckDuckGo search succeeded', { count: results.length });
      }
    } catch (error) {
      log.warn('DuckDuckGo failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Fallback to Brave if needed
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
          sourcesUsed.push('brave');
          log.info('Brave search succeeded', { count: braveResults.length });
        }
      } catch (error) {
        log.warn('Brave failed', { error: error instanceof Error ? error.message : String(error) });
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
            score: r.score * 10,
            publishDate: r.published_date ? new Date(r.published_date) : undefined,
          }));
          results = [...results, ...tavilyFormatted];
          sourcesUsed.push('tavily');
          log.info('Tavily search succeeded', { count: tavilyResults.length });
        }
      } catch (error) {
        log.error('All general search engines failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Fetch Wikipedia results
   */
  private async fetchWikipedia(query: string, limit: number): Promise<EnhancedSearchResult[]> {
    try {
      const wikiResults = await this.wikipedia.search(query, limit);
      return wikiResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: 'wikipedia' as const,
        score: 8, // High score for Wikipedia
      }));
    } catch (error) {
      log.warn('Wikipedia search failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Detect query type based on keywords
   */
  private detectQueryType(query: string): QueryType {
    const lowerQuery = query.toLowerCase();

    // News keywords
    if (lowerQuery.match(/\b(news|latest|breaking|today|yesterday|recent|current events|headlines)\b/)) {
      return 'news';
    }

    // Economic keywords
    if (lowerQuery.match(/\b(gdp|inflation|unemployment|interest rate|federal reserve|economic|economy|recession)\b/)) {
      return 'economic';
    }

    // Financial keywords
    if (lowerQuery.match(/\b(stock|stocks|ticker|nasdaq|dow jones|s&p 500|market|shares|dividend|earnings)\b/) ||
        lowerQuery.match(/\b[A-Z]{1,5}\b/)) { // Stock symbols
      return 'financial';
    }

    // Knowledge keywords
    if (lowerQuery.match(/\b(what is|who is|define|definition|explain|meaning of|history of)\b/)) {
      return 'knowledge';
    }

    return 'general';
  }

  /**
   * Score web sources by domain quality
   */
  private scoreByDomain(url: string): number {
    try {
      const domain = new URL(url).hostname.toLowerCase();

      // High-quality domains (8-10)
      if (domain.endsWith('.edu')) return 9;
      if (domain.endsWith('.gov')) return 9;
      if (domain.includes('wikipedia.org')) return 8;
      if (domain.includes('nytimes.com')) return 8;
      if (domain.includes('reuters.com')) return 8;
      if (domain.includes('bbc.com')) return 8;
      if (domain.includes('theguardian.com')) return 8;
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
  private deduplicateResults(results: EnhancedSearchResult[]): EnhancedSearchResult[] {
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
