/**
 * Source Manager
 * Manages multiple research source APIs for graduate-level research
 * Integrates: Semantic Scholar, OpenAlex, arXiv, Brave, Tavily
 */

import { log } from '../../lib/logger.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AcademicSource {
  id: string;
  source_type: 'academic_paper' | 'preprint';
  source_name: 'Semantic Scholar' | 'OpenAlex' | 'arXiv';
  title: string;
  authors: string[];
  url: string;
  doi?: string;
  publication_date?: string;
  summary: string;
  key_findings: string[];
  credibility_score: number; // 1-10
  citation_count: number;
  citation_info: {
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    publisher?: string;
    venue?: string;
  };
  full_content?: string;
}

export interface WebSource {
  id: string;
  source_type: 'web' | 'news';
  source_name: 'Brave' | 'Tavily';
  title: string;
  authors: string[];
  url: string;
  publication_date?: string;
  summary: string;
  key_findings: string[];
  credibility_score: number;
  citation_info: {
    website?: string;
    accessed?: string;
  };
}

export type ResearchSource = AcademicSource | WebSource;

// ============================================================================
// SOURCE MANAGER CLASS
// ============================================================================

export class SourceManager {
  private semanticScholarKey?: string;
  private braveApiKey?: string;
  private tavilyApiKey?: string;

  constructor() {
    this.semanticScholarKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    this.braveApiKey = process.env.BRAVE_API_KEY;
    this.tavilyApiKey = process.env.TAVILY_API_KEY;
  }

  // ==========================================================================
  // SEMANTIC SCHOLAR API
  // ==========================================================================

  /**
   * Search Semantic Scholar for academic papers
   * Free API with 100 requests per 5 minutes
   */
  async searchSemanticScholar(query: string, limit: number = 5): Promise<AcademicSource[]> {
    try {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,authors,year,citationCount,publicationDate,journal,url,externalIds`;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (this.semanticScholarKey) {
        headers['x-api-key'] = this.semanticScholarKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Semantic Scholar API error: ${response.status}`);
      }

      const data = (await response.json()) as { data?: any[] };

      const sources: AcademicSource[] = (data.data || []).map((paper: any) => ({
        id: paper.paperId || crypto.randomUUID(),
        source_type: 'academic_paper' as const,
        source_name: 'Semantic Scholar' as const,
        title: paper.title || 'Untitled',
        authors: (paper.authors || []).map((a: any) => a.name).filter(Boolean),
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        doi: paper.externalIds?.DOI,
        publication_date: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : undefined),
        summary: paper.abstract || 'No abstract available',
        key_findings: [], // Will be extracted later if needed
        credibility_score: this.scoreAcademicPaper(paper.citationCount, paper.year, paper.journal?.name),
        citation_count: paper.citationCount || 0,
        citation_info: {
          journal: paper.journal?.name,
          volume: paper.journal?.volume,
          pages: paper.journal?.pages,
        },
      }));

      log.info('Semantic Scholar search completed', {
        query,
        count: sources.length,
        avgCredibility: sources.length > 0 ? (sources.reduce((sum, s) => sum + s.credibility_score, 0) / sources.length).toFixed(1) : 0,
      });

      return sources;
    } catch (error: any) {
      log.error('Semantic Scholar search failed', { query, error: error.message });
      return [];
    }
  }

  // ==========================================================================
  // OPENALEX API
  // ==========================================================================

  /**
   * Search OpenAlex for academic works
   * Completely free, no API key required (but polite to add email in User-Agent)
   */
  async searchOpenAlex(query: string, limit: number = 5): Promise<AcademicSource[]> {
    try {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,title,abstract_inverted_index,authorships,publication_date,cited_by_count,primary_location,doi`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PersonalAI-ResearchAgent (mailto:research@personalai.com)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = (await response.json()) as { results?: any[] };

      const sources: AcademicSource[] = (data.results || []).map((work: any) => {
        // OpenAlex stores abstracts as inverted index - need to reconstruct
        const abstract = this.reconstructAbstract(work.abstract_inverted_index);

        return {
          id: work.id || crypto.randomUUID(),
          source_type: 'academic_paper' as const,
          source_name: 'OpenAlex' as const,
          title: work.title || 'Untitled',
          authors: (work.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
          url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : work.id,
          doi: work.doi?.replace('https://doi.org/', ''),
          publication_date: work.publication_date,
          summary: abstract || 'No abstract available',
          key_findings: [],
          credibility_score: this.scoreAcademicPaper(
            work.cited_by_count,
            work.publication_date ? new Date(work.publication_date).getFullYear() : undefined,
            work.primary_location?.source?.display_name
          ),
          citation_count: work.cited_by_count || 0,
          citation_info: {
            journal: work.primary_location?.source?.display_name,
            publisher: work.primary_location?.source?.host_organization_name,
          },
        };
      });

      log.info('OpenAlex search completed', {
        query,
        count: sources.length,
        avgCredibility: sources.length > 0 ? (sources.reduce((sum, s) => sum + s.credibility_score, 0) / sources.length).toFixed(1) : 0,
      });

      return sources;
    } catch (error: any) {
      log.error('OpenAlex search failed', { query, error: error.message });
      return [];
    }
  }

  /**
   * Reconstruct abstract from OpenAlex's inverted index format
   */
  private reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
    if (!invertedIndex) return '';

    try {
      const words: string[] = [];
      for (const [word, positions] of Object.entries(invertedIndex)) {
        positions.forEach(pos => {
          words[pos] = word;
        });
      }
      return words.filter(Boolean).join(' ').substring(0, 500); // Limit to 500 chars
    } catch (error) {
      return '';
    }
  }

  // ==========================================================================
  // ARXIV API
  // ==========================================================================

  /**
   * Search arXiv for preprints (especially good for STEM topics)
   * Completely free, no API key required
   */
  async searchArXiv(query: string, limit: number = 3): Promise<AcademicSource[]> {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();

      // Parse XML (simple approach - could use a proper XML parser)
      const sources: AcademicSource[] = [];
      const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

      for (const match of entryMatches) {
        const entry = match[1];

        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
        const idMatch = entry.match(/<id>(.*?)<\/id>/);

        // Extract authors
        const authors: string[] = [];
        const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g);
        for (const authorMatch of authorMatches) {
          authors.push(authorMatch[1].trim());
        }

        if (titleMatch && summaryMatch) {
          const arxivId = idMatch?.[1].split('/abs/')[1] || '';

          sources.push({
            id: arxivId || crypto.randomUUID(),
            source_type: 'preprint' as const,
            source_name: 'arXiv' as const,
            title: titleMatch[1].trim().replace(/\s+/g, ' '),
            authors,
            url: idMatch?.[1] || '',
            publication_date: publishedMatch?.[1].split('T')[0],
            summary: summaryMatch[1].trim().replace(/\s+/g, ' ').substring(0, 500),
            key_findings: [],
            credibility_score: 7, // arXiv papers are credible but not peer-reviewed
            citation_count: 0, // arXiv doesn't provide citation counts in API
            citation_info: {
              venue: 'arXiv preprint',
            },
          });
        }
      }

      log.info('arXiv search completed', {
        query,
        count: sources.length,
      });

      return sources;
    } catch (error: any) {
      log.error('arXiv search failed', { query, error: error.message });
      return [];
    }
  }

  // ==========================================================================
  // BRAVE SEARCH API (Existing)
  // ==========================================================================

  async searchBrave(query: string, limit: number = 3): Promise<WebSource[]> {
    if (!this.braveApiKey) {
      log.warn('Brave API key not configured');
      return [];
    }

    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(Math.min(limit, 20)));

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.braveApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.status}`);
      }

      const data = (await response.json()) as { web?: { results?: any[] } };

      const sources: WebSource[] = (data.web?.results || []).map((result: any, index: number) => ({
        id: crypto.randomUUID(),
        source_type: 'web' as const,
        source_name: 'Brave' as const,
        title: result.title || 'Untitled',
        authors: [], // Web sources typically don't have formal authors
        url: result.url,
        publication_date: result.age,
        summary: result.description || '',
        key_findings: [],
        credibility_score: this.scoreWebSource(result.url, result.description),
        citation_info: {
          website: new URL(result.url).hostname,
          accessed: new Date().toISOString().split('T')[0],
        },
      }));

      log.info('Brave search completed', { query, count: sources.length });

      return sources;
    } catch (error: any) {
      log.error('Brave search failed', { query, error: error.message });
      return [];
    }
  }

  // ==========================================================================
  // TAVILY SEARCH API (Existing)
  // ==========================================================================

  async searchTavily(query: string, limit: number = 3): Promise<WebSource[]> {
    if (!this.tavilyApiKey) {
      log.warn('Tavily API key not configured');
      return [];
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'advanced', // Use advanced for better quality
          max_results: limit,
          include_answer: false,
          include_raw_content: true, // Get full content if possible
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = (await response.json()) as { results?: any[] };

      const sources: WebSource[] = (data.results || []).map((result: any) => ({
        id: crypto.randomUUID(),
        source_type: 'web' as const,
        source_name: 'Tavily' as const,
        title: result.title || 'Untitled',
        authors: [],
        url: result.url,
        publication_date: result.published_date,
        summary: result.content || result.snippet || '',
        key_findings: [],
        credibility_score: Math.min(Math.round((result.score || 0.5) * 10), 10),
        citation_info: {
          website: new URL(result.url).hostname,
          accessed: new Date().toISOString().split('T')[0],
        },
        full_content: result.raw_content,
      }));

      log.info('Tavily search completed', { query, count: sources.length });

      return sources;
    } catch (error: any) {
      log.error('Tavily search failed', { query, error: error.message });
      return [];
    }
  }

  // ==========================================================================
  // SCORING FUNCTIONS
  // ==========================================================================

  /**
   * Score an academic paper's credibility (1-10)
   * Based on: citation count, publication year (recency), journal prestige
   */
  private scoreAcademicPaper(citations?: number, year?: number, journal?: string): number {
    let score = 5; // Base score

    // Citation count factor (+3 max)
    if (citations) {
      if (citations >= 100) score += 3;
      else if (citations >= 50) score += 2;
      else if (citations >= 10) score += 1;
    }

    // Recency factor (+2 max)
    if (year) {
      const age = new Date().getFullYear() - year;
      if (age <= 2) score += 2; // Very recent
      else if (age <= 5) score += 1; // Recent
      else if (age > 10) score -= 1; // Older
    }

    // Journal prestige (simple heuristic) (+1)
    if (journal) {
      const prestigiousKeywords = ['Nature', 'Science', 'Cell', 'Lancet', 'JAMA', 'IEEE', 'ACM'];
      if (prestigiousKeywords.some(k => journal.includes(k))) {
        score += 1;
      }
    }

    return Math.max(1, Math.min(10, score)); // Clamp to 1-10
  }

  /**
   * Score a web source's credibility (1-10)
   * Based on: domain reputation, content length
   */
  private scoreWebSource(url: string, content?: string): number {
    let score = 5; // Base score

    try {
      const domain = new URL(url).hostname.toLowerCase();

      // Trusted domains
      const trustedDomains = [
        'gov', 'edu', 'wikipedia.org', 'nature.com', 'sciencedirect.com',
        'nytimes.com', 'wsj.com', 'bbc.com', 'reuters.com', 'apnews.com'
      ];

      if (trustedDomains.some(d => domain.includes(d))) {
        score += 3;
      }

      // Less reliable domains
      const lessReliable = ['blog', 'wordpress', 'medium.com', 'quora.com'];
      if (lessReliable.some(d => domain.includes(d))) {
        score -= 2;
      }

      // Content length (longer = more substantial)
      if (content && content.length > 500) score += 1;

    } catch (error) {
      // Invalid URL
      score -= 2;
    }

    return Math.max(1, Math.min(10, score));
  }

  // ==========================================================================
  // SOURCE AGGREGATION
  // ==========================================================================

  /**
   * Gather sources from multiple APIs based on domain
   */
  async gatherSources(
    query: string,
    domain: string,
    targetCount: number = 12
  ): Promise<ResearchSource[]> {
    log.info('Gathering sources from multiple APIs', { query, domain, targetCount });

    const allSources: ResearchSource[] = [];

    // Determine which sources to use based on domain
    const sourcePlan = this.createSourcePlan(domain, targetCount);

    // Execute searches in parallel
    const searchPromises: Promise<ResearchSource[]>[] = [];

    if (sourcePlan.semanticScholar > 0) {
      searchPromises.push(this.searchSemanticScholar(query, sourcePlan.semanticScholar));
    }

    if (sourcePlan.openAlex > 0) {
      searchPromises.push(this.searchOpenAlex(query, sourcePlan.openAlex));
    }

    if (sourcePlan.arXiv > 0) {
      searchPromises.push(this.searchArXiv(query, sourcePlan.arXiv));
    }

    if (sourcePlan.brave > 0) {
      searchPromises.push(this.searchBrave(query, sourcePlan.brave));
    }

    if (sourcePlan.tavily > 0) {
      searchPromises.push(this.searchTavily(query, sourcePlan.tavily));
    }

    const results = await Promise.all(searchPromises);

    // Flatten and combine all sources
    results.forEach(sources => allSources.push(...sources));

    // Sort by credibility score (highest first)
    allSources.sort((a, b) => b.credibility_score - a.credibility_score);

    // Return top N sources
    const finalSources = allSources.slice(0, targetCount);

    log.info('Source gathering complete', {
      query,
      domain,
      total: allSources.length,
      selected: finalSources.length,
      avgCredibility: finalSources.length > 0
        ? (finalSources.reduce((sum, s) => sum + s.credibility_score, 0) / finalSources.length).toFixed(1)
        : 0,
      breakdown: {
        academic: finalSources.filter(s => s.source_type === 'academic_paper').length,
        preprints: finalSources.filter(s => s.source_type === 'preprint').length,
        web: finalSources.filter(s => s.source_type === 'web').length,
      },
    });

    return finalSources;
  }

  /**
   * Create a source allocation plan based on research domain
   */
  private createSourcePlan(domain: string, total: number): {
    semanticScholar: number;
    openAlex: number;
    arXiv: number;
    brave: number;
    tavily: number;
  } {
    switch (domain) {
      case 'medical':
      case 'academic':
        return {
          semanticScholar: Math.ceil(total * 0.4), // 40%
          openAlex: Math.ceil(total * 0.3),        // 30%
          arXiv: 0,                                 // 0%
          brave: Math.ceil(total * 0.15),          // 15%
          tavily: Math.ceil(total * 0.15),         // 15%
        };

      case 'tech':
      case 'engineering':
        return {
          semanticScholar: Math.ceil(total * 0.3),
          openAlex: Math.ceil(total * 0.25),
          arXiv: Math.ceil(total * 0.25),          // arXiv good for tech
          brave: Math.ceil(total * 0.1),
          tavily: Math.ceil(total * 0.1),
        };

      case 'news':
      case 'current':
        return {
          semanticScholar: 0,
          openAlex: 0,
          arXiv: 0,
          brave: Math.ceil(total * 0.5),           // 50% web search
          tavily: Math.ceil(total * 0.5),          // 50% web search
        };

      default: // general
        return {
          semanticScholar: Math.ceil(total * 0.25),
          openAlex: Math.ceil(total * 0.25),
          arXiv: Math.ceil(total * 0.1),
          brave: Math.ceil(total * 0.2),
          tavily: Math.ceil(total * 0.2),
        };
    }
  }
}
