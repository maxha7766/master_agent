/**
 * Document Metadata Extraction Service
 * Uses LLM to extract metadata from document content
 */

import { AnthropicProvider } from '../llm/anthropic.js';
import { log } from '../../lib/logger.js';

export interface ExtractedMetadata {
  document_type?: string;
  tags?: string[];
  entity_names?: string[];
  summary?: string;
}

export class MetadataExtractor {
  private llm: AnthropicProvider;

  constructor() {
    this.llm = new AnthropicProvider();
  }

  /**
   * Extract metadata from document content using LLM
   */
  async extractMetadata(
    content: string,
    fileName: string
  ): Promise<ExtractedMetadata> {
    try {
      // Truncate content if too long (keep first ~8000 chars for context)
      const truncatedContent = content.length > 8000
        ? content.substring(0, 8000) + '\n\n[Content truncated...]'
        : content;

      const prompt = `Analyze this document and extract metadata in JSON format.

Document filename: ${fileName}

Document content:
${truncatedContent}

Extract the following metadata:
1. document_type: Classify as one of: "email", "report", "FAQ", "contract", "meeting_notes", "article", "documentation", "other"
2. tags: List 3-5 relevant topic keywords/tags (lowercase, underscore-separated)
3. entity_names: List key people, places, or organizations mentioned (up to 10)
4. summary: Write a 2-3 sentence summary of the document's main content

Respond ONLY with valid JSON in this exact format:
{
  "document_type": "report",
  "tags": ["financial_analysis", "q4_results", "revenue"],
  "entity_names": ["John Smith", "Acme Corp", "New York"],
  "summary": "This is a summary of the document."
}`;

      const response = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        'claude-3-5-haiku-20241022', // Fast, cheap model for metadata extraction
        { temperature: 0.3 } // Low temperature for consistent extraction
      );

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.warn('Failed to extract JSON from metadata response', {
          fileName,
          response: response.content.substring(0, 200),
        });
        return this.generateFallbackMetadata(fileName);
      }

      const metadata = JSON.parse(jsonMatch[0]) as ExtractedMetadata;

      log.info('Metadata extracted successfully', {
        fileName,
        documentType: metadata.document_type,
        tagCount: metadata.tags?.length || 0,
        entityCount: metadata.entity_names?.length || 0,
      });

      return metadata;
    } catch (error) {
      log.error('Metadata extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        fileName,
      });
      return this.generateFallbackMetadata(fileName);
    }
  }

  /**
   * Generate basic fallback metadata if extraction fails
   */
  private generateFallbackMetadata(fileName: string): ExtractedMetadata {
    // Infer document type from filename
    const lowerName = fileName.toLowerCase();
    let document_type = 'other';

    if (lowerName.includes('email') || lowerName.includes('message')) {
      document_type = 'email';
    } else if (lowerName.includes('report')) {
      document_type = 'report';
    } else if (lowerName.includes('faq') || lowerName.includes('question')) {
      document_type = 'FAQ';
    } else if (lowerName.includes('contract') || lowerName.includes('agreement')) {
      document_type = 'contract';
    } else if (lowerName.includes('meeting') || lowerName.includes('notes')) {
      document_type = 'meeting_notes';
    }

    return {
      document_type,
      tags: [],
      entity_names: [],
      summary: `Document: ${fileName}`,
    };
  }
}

// Singleton instance
export const metadataExtractor = new MetadataExtractor();
