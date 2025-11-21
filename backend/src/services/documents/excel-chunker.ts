/**
 * Excel Documentation Structure-Aware Chunker
 * Specialized chunker that preserves function definitions, syntax, and code examples
 */

import { encode } from 'gpt-tokenizer';
import { log } from '../../lib/logger.js';
import type { ExcelChunkMetadata } from './excel-metadata-types.js';

export interface ExcelChunk {
  content: string;
  tokens: number;
  metadata: Partial<ExcelChunkMetadata>;
}

export interface ChunkingOptions {
  targetTokens?: number; // Default: 600 (larger than standard 500)
  overlapTokens?: number; // Default: 100 (more than standard 50)
  preserveCodeBlocks?: boolean; // Default: true
  minChunkTokens?: number; // Default: 100
}

export class ExcelChunker {
  private readonly DEFAULT_TARGET = 600;
  private readonly DEFAULT_OVERLAP = 100;
  private readonly MIN_CHUNK = 100;

  /**
   * Chunk Excel documentation content while preserving structure
   */
  async chunkDocument(
    content: string,
    baseMetadata: Partial<ExcelChunkMetadata>,
    options: ChunkingOptions = {}
  ): Promise<ExcelChunk[]> {
    const {
      targetTokens = this.DEFAULT_TARGET,
      overlapTokens = this.DEFAULT_OVERLAP,
      preserveCodeBlocks = true,
      minChunkTokens = this.MIN_CHUNK,
    } = options;

    log.info('Starting Excel document chunking', {
      contentLength: content.length,
      targetTokens,
      overlapTokens,
    });

    // First, detect and extract structural sections
    const sections = this.detectSections(content);

    if (sections.length === 0) {
      // No clear structure, use standard chunking
      return this.standardChunk(content, baseMetadata, targetTokens, overlapTokens);
    }

    // Process each section separately to preserve boundaries
    const chunks: ExcelChunk[] = [];

    for (const section of sections) {
      const sectionChunks = await this.chunkSection(
        section,
        baseMetadata,
        targetTokens,
        overlapTokens,
        minChunkTokens,
        preserveCodeBlocks
      );
      chunks.push(...sectionChunks);
    }

    log.info('Excel document chunking complete', {
      totalChunks: chunks.length,
      avgTokens: Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length),
    });

    return chunks;
  }

  /**
   * Detect logical sections in Excel documentation
   */
  private detectSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];

    // Detect sections by markdown headers (##, ###)
    const headerRegex = /^(#{2,3})\s+(.+)$/gm;
    const matches = [...content.matchAll(headerRegex)];

    if (matches.length === 0) {
      // No headers, treat entire document as one section
      return [
        {
          title: 'Main Content',
          content: content,
          sectionType: this.inferSectionType(content),
          startIndex: 0,
          endIndex: content.length,
        },
      ];
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headerLevel = match[1].length;
      const headerText = match[2].trim();
      const startIndex = match.index! + match[0].length;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();

      // Skip very short sections (likely navigation or metadata)
      if (sectionContent.length < 100) {
        continue;
      }

      sections.push({
        title: headerText,
        content: sectionContent,
        sectionType: this.inferSectionType(sectionContent, headerText),
        startIndex,
        endIndex,
        headerLevel,
      });
    }

    return sections;
  }

  /**
   * Infer section type from content and header
   */
  private inferSectionType(
    content: string,
    header?: string
  ): ExcelChunkMetadata['section_type'] {
    const lowerContent = content.toLowerCase();
    const lowerHeader = header?.toLowerCase() || '';

    // Check header first for explicit indicators
    if (lowerHeader.includes('syntax')) return 'syntax';
    if (lowerHeader.includes('example')) return 'example';
    if (lowerHeader.includes('parameter') || lowerHeader.includes('argument'))
      return 'parameters';
    if (lowerHeader.includes('error') || lowerHeader.includes('troubleshoot'))
      return 'troubleshooting';
    if (lowerHeader.includes('overview') || lowerHeader.includes('introduction'))
      return 'overview';

    // Analyze content patterns
    if (lowerContent.includes('syntax:') || /\w+\([^)]*\)/g.test(content)) {
      return 'syntax';
    }

    if (content.includes('```') || lowerContent.includes('example:')) {
      return 'example';
    }

    if (lowerContent.includes('#n/a') || lowerContent.includes('#ref!')) {
      return 'troubleshooting';
    }

    // Default to overview for general content
    return 'overview';
  }

  /**
   * Chunk a single section intelligently
   */
  private async chunkSection(
    section: DocumentSection,
    baseMetadata: Partial<ExcelChunkMetadata>,
    targetTokens: number,
    overlapTokens: number,
    minChunkTokens: number,
    preserveCodeBlocks: boolean
  ): Promise<ExcelChunk[]> {
    const chunks: ExcelChunk[] = [];

    // If section is small enough, keep it as one chunk
    const sectionTokens = this.countTokens(section.content);
    if (sectionTokens <= targetTokens * 1.2) {
      // Allow 20% over target to avoid unnecessary splits
      return [
        {
          content: section.content,
          tokens: sectionTokens,
          metadata: {
            ...baseMetadata,
            section_type: section.sectionType,
            parent_section: section.title,
          },
        },
      ];
    }

    // Section needs splitting - detect code blocks first
    const codeBlocks = preserveCodeBlocks ? this.extractCodeBlocks(section.content) : [];

    if (codeBlocks.length > 0) {
      // Split around code blocks to keep them intact
      return this.chunkWithCodeBlocks(
        section,
        codeBlocks,
        baseMetadata,
        targetTokens,
        overlapTokens
      );
    }

    // No code blocks - use paragraph-based chunking
    return this.chunkByParagraphs(
      section,
      baseMetadata,
      targetTokens,
      overlapTokens,
      minChunkTokens
    );
  }

  /**
   * Extract code blocks from content (markdown ``` blocks and =FORMULA patterns)
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];

    // Extract markdown code blocks (```...```)
    const markdownRegex = /```[\s\S]*?```/g;
    let match: RegExpExecArray | null;

    while ((match = markdownRegex.exec(content)) !== null) {
      blocks.push({
        content: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'markdown',
      });
    }

    // Extract inline formula patterns (=FUNCTION(...))
    const formulaRegex = /=[A-Z][A-Z0-9._]*\([^)]*\)/g;
    while ((match = formulaRegex.exec(content)) !== null) {
      // Check if this formula is already inside a markdown code block
      const insideCodeBlock = blocks.some(
        (block) => match!.index >= block.startIndex && match!.index < block.endIndex
      );

      if (!insideCodeBlock) {
        blocks.push({
          content: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          type: 'inline_formula',
        });
      }
    }

    return blocks.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Chunk content while preserving code blocks
   */
  private chunkWithCodeBlocks(
    section: DocumentSection,
    codeBlocks: CodeBlock[],
    baseMetadata: Partial<ExcelChunkMetadata>,
    targetTokens: number,
    overlapTokens: number
  ): ExcelChunk[] {
    const chunks: ExcelChunk[] = [];
    const content = section.content;
    let currentChunk = '';
    let currentTokens = 0;
    let position = 0;

    for (const block of codeBlocks) {
      // Add text before code block
      const textBefore = content.substring(position, block.startIndex);

      if (textBefore.trim()) {
        const textTokens = this.countTokens(textBefore);

        // Check if adding this text would exceed target
        if (currentTokens + textTokens > targetTokens && currentChunk.trim()) {
          // Save current chunk
          chunks.push({
            content: currentChunk.trim(),
            tokens: currentTokens,
            metadata: {
              ...baseMetadata,
              section_type: section.sectionType,
              parent_section: section.title,
            },
          });

          // Start new chunk with overlap
          const overlapContent = this.getOverlap(currentChunk, overlapTokens);
          currentChunk = overlapContent + textBefore;
          currentTokens = this.countTokens(currentChunk);
        } else {
          currentChunk += textBefore;
          currentTokens += textTokens;
        }
      }

      // Add code block (always keep intact)
      const blockTokens = this.countTokens(block.content);

      // If code block alone exceeds target, make it its own chunk
      if (blockTokens > targetTokens * 1.5) {
        // Save current chunk if exists
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            tokens: currentTokens,
            metadata: {
              ...baseMetadata,
              section_type: section.sectionType,
              parent_section: section.title,
              has_examples: true,
            },
          });
        }

        // Code block as separate chunk
        chunks.push({
          content: block.content,
          tokens: blockTokens,
          metadata: {
            ...baseMetadata,
            section_type: 'example',
            parent_section: section.title,
            has_examples: true,
          },
        });

        currentChunk = '';
        currentTokens = 0;
      } else if (currentTokens + blockTokens > targetTokens && currentChunk.trim()) {
        // Save current chunk and start new one with code block
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          metadata: {
            ...baseMetadata,
            section_type: section.sectionType,
            parent_section: section.title,
          },
        });

        currentChunk = block.content;
        currentTokens = blockTokens;
      } else {
        // Add code block to current chunk
        currentChunk += block.content;
        currentTokens += blockTokens;
      }

      position = block.endIndex;
    }

    // Add remaining text after last code block
    const remainingText = content.substring(position);
    if (remainingText.trim()) {
      currentChunk += remainingText;
      currentTokens = this.countTokens(currentChunk);
    }

    // Save final chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        metadata: {
          ...baseMetadata,
          section_type: section.sectionType,
          parent_section: section.title,
        },
      });
    }

    return chunks;
  }

  /**
   * Chunk by paragraphs when no code blocks present
   */
  private chunkByParagraphs(
    section: DocumentSection,
    baseMetadata: Partial<ExcelChunkMetadata>,
    targetTokens: number,
    overlapTokens: number,
    minChunkTokens: number
  ): ExcelChunk[] {
    const chunks: ExcelChunk[] = [];
    const paragraphs = section.content.split(/\n\s*\n/);

    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      const paragraphTokens = this.countTokens(paragraph);

      // Check if adding this paragraph would exceed target
      if (currentTokens + paragraphTokens > targetTokens && currentTokens >= minChunkTokens) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          metadata: {
            ...baseMetadata,
            section_type: section.sectionType,
            parent_section: section.title,
          },
        });

        // Start new chunk with overlap
        const overlapContent = this.getOverlap(currentChunk, overlapTokens);
        currentChunk = overlapContent + '\n\n' + paragraph;
        currentTokens = this.countTokens(currentChunk);
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Save final chunk
    if (currentChunk.trim() && currentTokens >= minChunkTokens) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        metadata: {
          ...baseMetadata,
          section_type: section.sectionType,
          parent_section: section.title,
        },
      });
    }

    return chunks;
  }

  /**
   * Standard chunking fallback (when no structure detected)
   */
  private standardChunk(
    content: string,
    baseMetadata: Partial<ExcelChunkMetadata>,
    targetTokens: number,
    overlapTokens: number
  ): ExcelChunk[] {
    const chunks: ExcelChunk[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);

    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);

      if (currentTokens + sentenceTokens > targetTokens && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          metadata: baseMetadata,
        });

        const overlapContent = this.getOverlap(currentChunk, overlapTokens);
        currentChunk = overlapContent + ' ' + sentence;
        currentTokens = this.countTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        metadata: baseMetadata,
      });
    }

    return chunks;
  }

  /**
   * Get overlap content (last N tokens from chunk)
   */
  private getOverlap(content: string, overlapTokens: number): string {
    if (overlapTokens === 0) return '';

    const sentences = content.split(/(?<=[.!?])\s+/);
    let overlap = '';
    let tokens = 0;

    // Build overlap from end backwards
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.countTokens(sentence);

      if (tokens + sentenceTokens <= overlapTokens) {
        overlap = sentence + (overlap ? ' ' : '') + overlap;
        tokens += sentenceTokens;
      } else {
        break;
      }
    }

    return overlap;
  }

  /**
   * Count tokens in text using GPT tokenizer
   */
  private countTokens(text: string): number {
    return encode(text).length;
  }
}

interface DocumentSection {
  title: string;
  content: string;
  sectionType: ExcelChunkMetadata['section_type'];
  startIndex: number;
  endIndex: number;
  headerLevel?: number;
}

interface CodeBlock {
  content: string;
  startIndex: number;
  endIndex: number;
  type: 'markdown' | 'inline_formula';
}
