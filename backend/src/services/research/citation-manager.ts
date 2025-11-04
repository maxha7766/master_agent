/**
 * Citation Manager
 * Handles citation formatting for APA, MLA, and Chicago styles
 * Inserts in-text citations and generates reference lists
 */

import { log } from '../../lib/logger.js';

export type CitationStyle = 'APA' | 'MLA' | 'Chicago';

export interface Source {
  title: string;
  authors: string[];
  publication_date?: string;
  url?: string;
  doi?: string;
  source_type: string;
  citation_info: {
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    publisher?: string;
    website?: string;
  };
}

export class CitationManager {
  /**
   * Insert formatted in-text citations into content
   * Replaces placeholders like [Smith 2024] with proper format
   */
  async insertCitations(
    content: string,
    sources: Source[],
    style: CitationStyle
  ): Promise<string> {
    let formatted = content;

    // Find all citation placeholders [Author Year] or [Author et al. Year]
    const citationPattern = /\[([A-Z][a-z]+(?:\s+et\s+al\.)?)\s+(\d{4})\]/g;

    const matches = [...content.matchAll(citationPattern)];

    for (const match of matches) {
      const placeholder = match[0]; // Full match like "[Smith 2024]"
      const author = match[1]; // "Smith" or "Smith et al."
      const year = match[2]; // "2024"

      // Find matching source
      const source = this.findSource(sources, author, year);

      if (source) {
        const inTextCitation = this.formatInTextCitation(source, style);
        formatted = formatted.replace(placeholder, inTextCitation);
      }
    }

    return formatted;
  }

  /**
   * Generate complete reference list
   */
  async generateReferenceList(
    sources: Source[],
    style: CitationStyle
  ): Promise<string> {
    // Sort sources alphabetically by first author's last name
    const sorted = [...sources].sort((a, b) => {
      const aAuthor = a.authors[0] || 'Unknown';
      const bAuthor = b.authors[0] || 'Unknown';
      return aAuthor.localeCompare(bAuthor);
    });

    // Format each source
    const references = sorted.map(source =>
      this.formatReference(source, style)
    );

    // Create reference section
    let referenceSection = '## References\n\n';

    if (style === 'Chicago') {
      // Chicago uses footnotes, but we'll do bibliography style
      referenceSection = '## Bibliography\n\n';
    }

    referenceSection += references.join('\n\n');

    return referenceSection;
  }

  // ==========================================================================
  // IN-TEXT CITATION FORMATTING
  // ==========================================================================

  /**
   * Format in-text citation based on style
   */
  private formatInTextCitation(source: Source, style: CitationStyle): string {
    const year = this.extractYear(source.publication_date);
    const authors = source.authors;

    switch (style) {
      case 'APA':
        return this.formatAPAInText(authors, year);

      case 'MLA':
        return this.formatMLAInText(authors);

      case 'Chicago':
        return this.formatChicagoInText(authors, year);

      default:
        return this.formatAPAInText(authors, year);
    }
  }

  private formatAPAInText(authors: string[], year: string): string {
    if (authors.length === 0) return '(Unknown, n.d.)';
    if (authors.length === 1) return `(${authors[0]}, ${year})`;
    if (authors.length === 2) return `(${authors[0]} & ${authors[1]}, ${year})`;
    return `(${authors[0]} et al., ${year})`;
  }

  private formatMLAInText(authors: string[]): string {
    if (authors.length === 0) return '(Unknown)';
    if (authors.length === 1) return `(${authors[0]})`;
    if (authors.length === 2) return `(${authors[0]} and ${authors[1]})`;
    return `(${authors[0]} et al.)`;
  }

  private formatChicagoInText(authors: string[], year: string): string {
    // Chicago typically uses footnotes, but for simplicity we'll use author-date
    if (authors.length === 0) return '(Unknown n.d.)';
    if (authors.length === 1) return `(${authors[0]} ${year})`;
    if (authors.length === 2) return `(${authors[0]} and ${authors[1]} ${year})`;
    return `(${authors[0]} et al. ${year})`;
  }

  // ==========================================================================
  // REFERENCE LIST FORMATTING
  // ==========================================================================

  /**
   * Format full reference entry
   */
  private formatReference(source: Source, style: CitationStyle): string {
    switch (style) {
      case 'APA':
        return this.formatAPAReference(source);

      case 'MLA':
        return this.formatMLAReference(source);

      case 'Chicago':
        return this.formatChicagoReference(source);

      default:
        return this.formatAPAReference(source);
    }
  }

  /**
   * APA 7th Edition format
   */
  private formatAPAReference(source: Source): string {
    const authors = this.formatAuthorsAPA(source.authors);
    const year = this.extractYear(source.publication_date) || 'n.d.';
    const title = source.title;
    const journal = source.citation_info.journal;
    const volume = source.citation_info.volume;
    const pages = source.citation_info.pages;
    const doi = source.doi;
    const url = source.url;

    let reference = `${authors} (${year}). *${title}*`;

    if (journal) {
      reference += `. *${journal}*`;
      if (volume) reference += `, *${volume}*`;
      if (pages) reference += `, ${pages}`;
    }

    if (doi) {
      reference += `. https://doi.org/${doi}`;
    } else if (url && source.source_type !== 'academic_paper') {
      reference += `. ${url}`;
    }

    return reference;
  }

  /**
   * MLA 9th Edition format
   */
  private formatMLAReference(source: Source): string {
    const authors = this.formatAuthorsMLA(source.authors);
    const title = `"${source.title}"`;
    const journal = source.citation_info.journal;
    const volume = source.citation_info.volume;
    const year = this.extractYear(source.publication_date);
    const pages = source.citation_info.pages;
    const url = source.url;

    let reference = `${authors}. ${title}`;

    if (journal) {
      reference += `. *${journal}*`;
      if (volume) reference += `, vol. ${volume}`;
      if (year) reference += `, ${year}`;
      if (pages) reference += `, pp. ${pages}`;
    }

    if (url) {
      reference += `. ${url}`;
    }

    return reference;
  }

  /**
   * Chicago 17th Edition format (Bibliography style)
   */
  private formatChicagoReference(source: Source): string {
    const authors = this.formatAuthorsChicago(source.authors);
    const year = this.extractYear(source.publication_date);
    const title = source.title;
    const journal = source.citation_info.journal;
    const volume = source.citation_info.volume;
    const pages = source.citation_info.pages;
    const doi = source.doi;
    const url = source.url;

    let reference = `${authors}. ${year}. "${title}"`;

    if (journal) {
      reference += `. *${journal}*`;
      if (volume) reference += ` ${volume}`;
      if (pages) reference += `: ${pages}`;
    }

    if (doi) {
      reference += `. https://doi.org/${doi}`;
    } else if (url && source.source_type !== 'academic_paper') {
      reference += `. ${url}`;
    }

    return reference;
  }

  // ==========================================================================
  // AUTHOR FORMATTING
  // ==========================================================================

  private formatAuthorsAPA(authors: string[]): string {
    if (authors.length === 0) return 'Unknown';
    if (authors.length === 1) return this.formatAuthorLastFirst(authors[0]);

    const formattedAuthors = authors.slice(0, -1).map(a => this.formatAuthorLastFirst(a));
    const lastAuthor = this.formatAuthorLastFirst(authors[authors.length - 1]);

    if (authors.length === 2) {
      return `${formattedAuthors[0]}, & ${lastAuthor}`;
    }

    return `${formattedAuthors.join(', ')}, & ${lastAuthor}`;
  }

  private formatAuthorsMLA(authors: string[]): string {
    if (authors.length === 0) return 'Unknown';
    if (authors.length === 1) return this.formatAuthorLastFirst(authors[0]);

    const first = this.formatAuthorLastFirst(authors[0]);
    const rest = authors.slice(1).join(', ');

    if (authors.length === 2) {
      return `${first}, and ${rest}`;
    }

    return `${first}, et al.`;
  }

  private formatAuthorsChicago(authors: string[]): string {
    return this.formatAuthorsAPA(authors); // Chicago similar to APA for authors
  }

  /**
   * Format author name as "Last, First"
   */
  private formatAuthorLastFirst(fullName: string): string {
    // If already in "Last, First" format, return as is
    if (fullName.includes(',')) return fullName;

    // Split by space and rearrange
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];

    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');

    return `${lastName}, ${firstName}`;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Extract year from date string
   */
  private extractYear(date?: string): string {
    if (!date) return 'n.d.';

    // Try to extract year (YYYY)
    const match = date.match(/(\d{4})/);
    return match ? match[1] : 'n.d.';
  }

  /**
   * Find source by author and year
   */
  private findSource(sources: Source[], author: string, year: string): Source | null {
    // Remove "et al." if present
    const cleanAuthor = author.replace(/\s+et\s+al\./i, '').trim();

    return sources.find(source => {
      if (source.authors.length === 0) return false;

      const firstAuthorLastName = source.authors[0].split(' ').pop() || '';
      const sourceYear = this.extractYear(source.publication_date);

      return firstAuthorLastName.toLowerCase() === cleanAuthor.toLowerCase() &&
             sourceYear === year;
    }) || null;
  }

  /**
   * Validate that all citations have corresponding sources
   */
  async validateCitations(content: string, sources: Source[]): Promise<{
    valid: boolean;
    missingCitations: string[];
  }> {
    const citationPattern = /\[([A-Z][a-z]+(?:\s+et\s+al\.)?)\s+(\d{4})\]/g;
    const matches = [...content.matchAll(citationPattern)];

    const missingCitations: string[] = [];

    for (const match of matches) {
      const author = match[1];
      const year = match[2];
      const source = this.findSource(sources, author, year);

      if (!source) {
        missingCitations.push(match[0]);
      }
    }

    return {
      valid: missingCitations.length === 0,
      missingCitations,
    };
  }
}
