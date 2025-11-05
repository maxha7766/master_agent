/**
 * Topic Clarification Agent
 * Refines user's raw topic into optimized search query + subtopics
 */
import { AnthropicProvider } from '../../services/llm/anthropic.js';
import { log } from '../../lib/logger.js';

export interface ClarifiedTopic {
  searchQuery: string;
  subtopics: string[];
  originalTopic: string;
}

export class TopicClarifier {
  private llm = new AnthropicProvider();

  async clarify(rawTopic: string): Promise<ClarifiedTopic> {
    const prompt = `You are a research assistant helping refine a topic for web search.

User's topic: "${rawTopic}"

Your task:
1. Create an optimized search query (concise, keyword-focused, removes unnecessary words)
2. Identify 3-5 subtopics to explore (specific aspects worth researching)

Return JSON only, no explanations:
{
  "searchQuery": "optimized search query",
  "subtopics": ["subtopic 1", "subtopic 2", "subtopic 3"]
}

Example:
User topic: "Tell me about the best liberal arts colleges in the northeast"
Response:
{
  "searchQuery": "top liberal arts colleges northeastern united states rankings",
  "subtopics": ["academic rankings", "student life quality", "admissions selectivity", "financial aid packages", "campus locations"]
}`;

    try {
      log.info('Topic clarification started', { rawTopic });

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ], 'claude-3-haiku-20240307', { temperature: 0.3 });

      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      log.info('Topic clarified successfully', {
        searchQuery: parsed.searchQuery,
        subtopicsCount: parsed.subtopics.length
      });

      return {
        searchQuery: parsed.searchQuery,
        subtopics: parsed.subtopics,
        originalTopic: rawTopic,
      };
    } catch (error) {
      log.error('Topic clarification failed', {
        error: error instanceof Error ? error.message : String(error),
        rawTopic
      });

      // Fallback: use raw topic as search query
      return {
        searchQuery: rawTopic,
        subtopics: [],
        originalTopic: rawTopic,
      };
    }
  }
}
