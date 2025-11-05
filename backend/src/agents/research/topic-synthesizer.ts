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
    const sourcesText = input.sources
      .map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nFrom: ${s.sourceEngine}\n\n${s.content}\n\n---`)
      .join('\n\n');

    const currentDate = new Date().toISOString().split('T')[0];
    const searchEngines = [...new Set(input.sources.map(s => s.sourceEngine))].join(', ');

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

    try {
      log.info('Topic synthesis started', {
        topic: input.topic,
        sourcesCount: input.sources.length
      });

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ], 'claude-sonnet-4-20250514', {
        temperature: 0.5,
        maxTokens: 16000,
      });

      const wordCount = response.content.split(/\s+/).length;
      log.info('Topic synthesis completed', {
        topic: input.topic,
        wordCount,
        characterCount: response.content.length
      });

      return response.content;
    } catch (error) {
      log.error('Topic synthesis failed', {
        error: error instanceof Error ? error.message : String(error),
        topic: input.topic
      });
      throw error;
    }
  }
}
