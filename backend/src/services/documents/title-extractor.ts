/**
 * Document Title Extraction Service
 * Uses AI to extract the actual document title from content
 */

import { LLMFactory } from '../llm/factory.js';
import { log } from '../../lib/logger.js';

export interface TitleExtractionResult {
  title: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

export class TitleExtractor {
  /**
   * Extract document title from first few pages/lines of content
   * @param content - First 250-500 lines or characters of document
   * @param fileName - Original filename (as fallback context)
   * @param model - LLM model to use
   */
  async extractTitle(
    content: string,
    fileName: string,
    model: string = 'claude-sonnet-4-5-20250929'
  ): Promise<TitleExtractionResult> {
    try {
      const provider = LLMFactory.getProvider(model);

      // Limit content to first 3000 characters for efficiency
      const excerpt = content.substring(0, 3000);

      const systemPrompt = `You are a document title extraction specialist. Your task is to identify the actual title of a document by analyzing its content.

**Your Task:**
1. Read the beginning of the document
2. Identify the main title/heading (not the filename)
3. Return a clean, professional title

**Guidelines:**
- Look for title pages, headers, main headings
- Ignore filenames, watermarks, metadata, page numbers
- Remove unnecessary prefixes like "Document:", "Title:", etc.
- Keep it concise (3-8 words ideally)
- Use title case formatting
- If multiple titles exist (e.g., report name + subtitle), use the most prominent one

**Examples:**
- Content with "WEEKLY MARKET REPORT - Securitized Products" → "Securitized Products Weekly"
- Content with "Annual Report 2024 - Financial Performance" → "Annual Report 2024"
- Content with header "JPMorgan Chase Q3 Earnings Call Transcript" → "Q3 Earnings Call Transcript"

**Response Format (JSON):**
{
  "title": "The Extracted Title",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this is the title"
}`;

      const userPrompt = `Original Filename: "${fileName}"

Document Content (first section):
${excerpt}

What is the actual title of this document?`;

      const response = await provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model,
        { temperature: 0.3 } // Low temperature for consistency
      );

      // Parse JSON response - strip markdown code blocks if present
      let jsonContent = response.content.trim();

      // Remove markdown code blocks (```json ... ```)
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/,'');
      }

      const result = JSON.parse(jsonContent);

      log.info('Title extracted', {
        fileName,
        extractedTitle: result.title,
        confidence: result.confidence,
      });

      return {
        title: result.title || this.cleanFilename(fileName),
        confidence: result.confidence || 'medium',
        reasoning: result.reasoning,
      };
    } catch (error) {
      log.error('Title extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        fileName,
      });

      // Fallback to cleaned filename
      return {
        title: this.cleanFilename(fileName),
        confidence: 'low',
        reasoning: 'Extraction failed, using cleaned filename',
      };
    }
  }

  /**
   * Clean filename to use as fallback title
   * Removes file extension, timestamps, IDs, and cleans up formatting
   */
  private cleanFilename(fileName: string): string {
    // Remove file extension
    let cleaned = fileName.replace(/\.[^.]+$/, '');

    // Remove common ID patterns (e.g., _123456, -abc123def)
    cleaned = cleaned.replace(/_\d{6,}/g, '');
    cleaned = cleaned.replace(/[-_][A-F0-9]{8,}/gi, '');

    // Remove date patterns (e.g., 2024-10-24, 20241024)
    cleaned = cleaned.replace(/[-_]?\d{4}[-_]?\d{2}[-_]?\d{2}/g, '');

    // Remove common prefixes
    cleaned = cleaned.replace(/^(doc|file|document|report)[-_]/i, '');

    // Replace underscores/hyphens with spaces
    cleaned = cleaned.replace(/[_-]+/g, ' ');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Trim and capitalize first letter of each word (title case)
    cleaned = cleaned
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // If result is too short or empty, use original filename
    if (cleaned.length < 3) {
      return fileName.replace(/\.[^.]+$/, '');
    }

    return cleaned;
  }
}

// Export singleton
export const titleExtractor = new TitleExtractor();
