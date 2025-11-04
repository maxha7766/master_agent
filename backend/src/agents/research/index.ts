/**
 * Research Agent
 * Performs web research using Tavily and Brave Search APIs
 *
 * Simplified implementation inspired by Bobby_Boy's research agent
 * Focused on quick web research for answering questions
 */

import { log } from '../../lib/logger.js';

export interface ResearchSource {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  author?: string;
  source: 'tavily' | 'brave';
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  summary?: string;
  domain: string;
  totalResults: number;
}

export class ResearchAgent {
  private tavilyApiKey: string;
  private braveApiKey: string;

  constructor() {
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    this.braveApiKey = process.env.BRAVE_API_KEY || '';

    if (!this.tavilyApiKey && !this.braveApiKey) {
      throw new Error('No research API keys configured. Set TAVILY_API_KEY or BRAVE_API_KEY');
    }
  }

  /**
   * Execute research on a topic
   * @param query - Research query/topic
   * @param maxResults - Maximum number of results to return (default: 10)
   * @returns Research results with sources
   */
  async executeResearch(query: string, maxResults: number = 10): Promise<ResearchResult> {
    log.info('Research agent executing query', { query, maxResults });

    // Analyze domain for better source selection
    const domain = this.analyzeDomain(query);
    log.debug('Analyzed query domain', { query, domain });

    const sources: ResearchSource[] = [];

    // Try Tavily first (better quality results)
    if (this.tavilyApiKey) {
      try {
        const tavilySources = await this.searchTavily(query, Math.ceil(maxResults * 0.7));
        sources.push(...tavilySources);
        log.info('Tavily search completed', { count: tavilySources.length });
      } catch (error) {
        log.error('Tavily search failed', { error });
      }
    }

    // Use Brave to fill remaining slots
    if (sources.length < maxResults && this.braveApiKey) {
      try {
        const remaining = maxResults - sources.length;
        const braveSources = await this.searchBrave(query, remaining);
        sources.push(...braveSources);
        log.info('Brave search completed', { count: braveSources.length });
      } catch (error) {
        log.error('Brave search failed', { error });
      }
    }

    // Sort by score
    sources.sort((a, b) => b.score - a.score);

    const result: ResearchResult = {
      query,
      sources: sources.slice(0, maxResults),
      domain,
      totalResults: sources.length,
    };

    log.info('Research completed', {
      query,
      domain,
      sourcesFound: result.sources.length,
      tavilyCount: result.sources.filter(s => s.source === 'tavily').length,
      braveCount: result.sources.filter(s => s.source === 'brave').length,
    });

    return result;
  }

  /**
   * Analyze query to determine research domain
   * Used for optimizing source selection
   */
  private analyzeDomain(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Domain classification (simplified from Bobby_Boy)
    const domains = {
      medical: ['health', 'disease', 'medical', 'clinical', 'patient', 'diagnosis', 'treatment'],
      tech: ['programming', 'software', 'code', 'developer', 'tech', 'api', 'framework'],
      academic: ['research', 'study', 'paper', 'journal', 'scientific', 'scholar'],
      news: ['recent', 'latest', 'news', '2024', '2025', 'current', 'breaking'],
      general: [],
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Search using Tavily API
   * Tavily provides high-quality, AI-optimized search results
   */
  private async searchTavily(query: string, maxResults: number): Promise<ResearchSource[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.tavilyApiKey,
        query,
        search_depth: 'basic', // 'basic' or 'advanced'
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return (data.results || []).map((result: any) => ({
      title: result.title || 'Untitled',
      url: result.url,
      content: result.content || result.snippet || '',
      score: result.score || 0.5,
      published_date: result.published_date,
      source: 'tavily' as const,
    }));
  }

  /**
   * Search using Brave Search API
   * Good fallback with broad coverage
   */
  private async searchBrave(query: string, maxResults: number): Promise<ResearchSource[]> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(Math.min(maxResults, 20)));

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.braveApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return (data.web?.results || []).map((result: any, index: number) => ({
      title: result.title || 'Untitled',
      url: result.url,
      content: result.description || '',
      score: 1.0 - (index * 0.05), // Decreasing score by position
      published_date: result.age,
      author: result.meta_url?.netloc,
      source: 'brave' as const,
    }));
  }

  /**
   * Generate a summary from research results
   * Uses the research sources to create a concise overview
   */
  async generateSummary(query: string, sources: ResearchSource[]): Promise<string> {
    if (sources.length === 0) {
      return `No sources found for query: "${query}"`;
    }

    // For now, return a simple summary
    // TODO: Could use LLM to generate better summaries
    const topSources = sources.slice(0, 3);
    const summary = topSources.map(s => s.content.substring(0, 200)).join('\n\n');

    return `Research on "${query}":\n\n${summary}`;
  }

  /**
   * Generate a markdown research report
   * Creates a comprehensive markdown document from search results
   */
  generateMarkdownReport(query: string, sources: ResearchSource[], domain: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let markdown = `# Research Report: ${query}\n\n`;
    markdown += `**Generated:** ${dateStr}\n`;
    markdown += `**Domain:** ${domain}\n`;
    markdown += `**Sources:** ${sources.length}\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## Executive Summary\n\n`;
    markdown += `This research report synthesizes information from ${sources.length} web sources `;
    markdown += `on the topic "${query}". Sources include `;

    const tavilyCount = sources.filter(s => s.source === 'tavily').length;
    const braveCount = sources.filter(s => s.source === 'brave').length;

    const sourceParts = [];
    if (tavilyCount > 0) sourceParts.push(`${tavilyCount} from Tavily`);
    if (braveCount > 0) sourceParts.push(`${braveCount} from Brave Search`);
    markdown += sourceParts.join(' and ') + '.\n\n';

    // Key Findings (from top sources)
    markdown += `## Key Findings\n\n`;
    sources.slice(0, 5).forEach((source, index) => {
      markdown += `### ${index + 1}. ${source.title}\n\n`;
      markdown += `${source.content}\n\n`;
      markdown += `**Source:** [${source.url}](${source.url})\n`;
      markdown += `**Relevance Score:** ${(source.score * 100).toFixed(0)}%\n`;
      if (source.published_date) {
        markdown += `**Published:** ${source.published_date}\n`;
      }
      markdown += `\n`;
    });

    // All Sources (Bibliography)
    markdown += `## Sources & References\n\n`;
    sources.forEach((source, index) => {
      markdown += `${index + 1}. **${source.title}**\n`;
      markdown += `   - URL: ${source.url}\n`;
      markdown += `   - Source: ${source.source === 'tavily' ? 'Tavily' : 'Brave Search'}\n`;
      markdown += `   - Relevance: ${(source.score * 100).toFixed(0)}%\n`;
      if (source.published_date) {
        markdown += `   - Published: ${source.published_date}\n`;
      }
      markdown += `\n`;
    });

    // Metadata
    markdown += `---\n\n`;
    markdown += `## Research Metadata\n\n`;
    markdown += `- **Query:** ${query}\n`;
    markdown += `- **Research Domain:** ${domain}\n`;
    markdown += `- **Total Sources:** ${sources.length}\n`;
    markdown += `- **Date Generated:** ${dateStr}\n`;
    markdown += `- **Generated by:** Personal AI Assistant Research Agent\n`;

    return markdown;
  }
}
