/**
 * Topic Synthesis Agent
 * Synthesizes web sources into comprehensive markdown knowledge base
 */
import { AnthropicProvider } from '../../services/llm/anthropic.js';
import { log } from '../../lib/logger.js';

export interface SynthesisInput {
  topic: string;
  subtopics: string[];
  sources: Array<{
    title: string;
    url: string;
    content: string;
    sourceEngine: string;
  }>;
}

export class TopicSynthesizer {
  private llm = new AnthropicProvider();

  async synthesize(input: SynthesisInput): Promise<string> {
    const SYNTHESIS_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const MAX_RETRIES = 3;
    const RETRY_DELAY_BASE = 5000; // 5 seconds
    const MAX_CHARS_PER_SOURCE = 15000; // ~3,750 tokens per source (4 chars/token avg)
    const MAX_TOTAL_PROMPT_CHARS = 600000; // ~150k tokens (leaves room for response)

    // Truncate sources to prevent prompt overflow
    const truncatedSources = input.sources.map(s => ({
      ...s,
      content: s.content.length > MAX_CHARS_PER_SOURCE
        ? s.content.substring(0, MAX_CHARS_PER_SOURCE) + '\n\n[Content truncated for length...]'
        : s.content
    }));

    const truncatedCount = input.sources.filter(s => s.content.length > MAX_CHARS_PER_SOURCE).length;
    if (truncatedCount > 0) {
      log.info('Source content truncated', {
        topic: input.topic,
        truncatedSources: truncatedCount,
        totalSources: input.sources.length
      });
    }

    const sourcesText = truncatedSources
      .map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nFrom: ${s.sourceEngine}\n\n${s.content}\n\n---`)
      .join('\n\n');

    const currentDate = new Date().toISOString().split('T')[0];
    const searchEngines = [...new Set(input.sources.map(s => s.sourceEngine))].join(', ');

    log.info('Prompt size check', {
      topic: input.topic,
      sourcesTextChars: sourcesText.length,
      estimatedTokens: Math.ceil(sourcesText.length / 4),
      maxAllowed: MAX_TOTAL_PROMPT_CHARS
    });

    const prompt = `You are synthesizing web research into a comprehensive knowledge base document.

Topic: ${input.topic}
${input.subtopics.length > 0 ? `Subtopics to cover: ${input.subtopics.join(', ')}` : ''}

Sources (${input.sources.length} total):
${sourcesText}

Create a comprehensive markdown document with this structure:

# Knowledge Base: ${input.topic}

---
**Research Date:** ${currentDate}
**Sources:** ${input.sources.length}
**Search Engines:** ${searchEngines}
---

## Executive Summary

[Write 3-5 paragraphs summarizing the most important findings about this topic]

## [Major Theme 1]

[Comprehensive coverage of first major theme found in sources. Include specific data, statistics, rankings, comparisons. Use inline citations like [1], [2]]

## [Major Theme 2]

[Continue with additional major themes...]

## Key Findings

- [Finding 1 with citation [X]]
- [Finding 2 with citation [Y]]
- ...

[If applicable, include comparison tables, rankings, or data visualizations in markdown format]

## References

1. [Source title] - [URL]
2. ...

---

Guidelines:
- Extract ALL relevant information from sources
- Organize content by natural themes found in the material
- Include specific data, rankings, statistics, comparisons
- Use inline citations: [1], [2], etc.
- Create tables for comparative data when useful
- Target length: 3,000-8,000 words
- Write in clear, accessible language
- Focus on factual information from sources
- Do NOT add information not found in the sources

Return ONLY the markdown document, no preamble or explanation.`;

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        log.info('Topic synthesis started', {
          topic: input.topic,
          sourcesCount: input.sources.length,
          attempt,
          maxRetries: MAX_RETRIES
        });

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Synthesis timeout after ${SYNTHESIS_TIMEOUT / 1000} seconds`));
          }, SYNTHESIS_TIMEOUT);
        });

        // Create synthesis promise
        const synthesisPromise = this.llm.chat([
          { role: 'user', content: prompt }
        ], 'claude-3-haiku-20240307', {
          temperature: 0.5,
          maxTokens: 16000,
        });

        // Race between timeout and synthesis
        const response = await Promise.race([synthesisPromise, timeoutPromise]);

        const wordCount = response.content.split(/\s+/).length;
        log.info('Topic synthesis completed', {
          topic: input.topic,
          wordCount,
          characterCount: response.content.length,
          attempt
        });

        return response.content;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMsg.includes('timeout');

        log.error('Topic synthesis failed', {
          error: errorMsg,
          topic: input.topic,
          attempt,
          maxRetries: MAX_RETRIES,
          isTimeout
        });

        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          throw new Error(`Synthesis failed after ${MAX_RETRIES} attempts: ${errorMsg}`);
        }

        // If timeout or network error, retry with exponential backoff
        if (isTimeout || errorMsg.includes('network') || errorMsg.includes('ECONNRESET')) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          log.info('Retrying synthesis after delay', {
            topic: input.topic,
            attempt: attempt + 1,
            delayMs: delay
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // For other errors (e.g., validation, API errors), don't retry
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Synthesis failed: Unexpected error');
  }
}
