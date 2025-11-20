import Anthropic from '@anthropic-ai/sdk';
import { estimateTokenCount } from '../../lib/utils.js';
import { llmCache } from './cache.js';
import type {
  LLMProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  StreamChunk,
} from './provider.js';

/**
 * Anthropic LLM Provider
 * Supports Claude Sonnet 4.5, Claude Haiku, and other Claude models
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const temperature = options.temperature ?? 0.7;

    // Only cache low-temperature (deterministic) queries
    const shouldCache = temperature <= 0.2;

    // Check cache first
    if (shouldCache) {
      const cached = llmCache.get(messages, model, temperature);
      if (cached) {
        return {
          content: cached,
          model,
          tokensUsed: {
            input: 0, // Cache hit - no tokens used
            output: 0,
            total: 0,
          },
          finishReason: 'cache_hit',
        };
      }
    }

    // Separate system messages from conversation
    const systemMessage = messages.find((msg) => msg.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature,
      top_p: options.topP,
      system: systemMessage || undefined,
      messages: conversationMessages,
      stream: false,
    });

    const content =
      response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('') || '';

    // Cache the response if appropriate
    if (shouldCache && content) {
      llmCache.set(messages, model, temperature, content);
    }

    return {
      content,
      model: response.model,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason || 'end_turn',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    model: string,
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Separate system messages from conversation
    const systemMessage = messages.find((msg) => msg.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const stream = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP,
      system: systemMessage || undefined,
      messages: conversationMessages,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield {
            content: delta.text,
            done: false,
          };
        }
      } else if (event.type === 'message_stop') {
        yield {
          content: '',
          done: true,
        };
      }
    }
  }

  async countTokens(content: string, _model: string): Promise<number> {
    // Anthropic doesn't provide a token counting API
    // Use estimation for now
    return estimateTokenCount(content);
  }

  getSupportedModels(): string[] {
    return [
      // Claude Sonnet 4.5 (Latest - September 2025)
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5', // Alias for latest 4.5
      // Claude Sonnet 4
      'claude-sonnet-4-20250514',
      // Claude 3.5 Sonnet
      'claude-3-5-sonnet-20241022',
      // Claude Haiku
      'claude-haiku',
      'claude-3-haiku-20240307',
      // Claude Opus
      'claude-3-opus-20240229',
    ];
  }
}
