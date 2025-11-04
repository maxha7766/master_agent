import OpenAI from 'openai';
import { estimateTokenCount } from '../../lib/utils.js';
import type {
  LLMProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  StreamChunk,
} from './provider.js';

/**
 * OpenAI LLM Provider
 * Supports GPT-4, GPT-3.5-turbo, and embedding models
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: false,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      model: response.model,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason || 'stop',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    model: string,
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content || '';
      const done = chunk.choices[0]?.finish_reason !== null;

      yield {
        content,
        done,
      };
    }
  }

  async countTokens(content: string, _model: string): Promise<number> {
    // For now, use simple estimation
    // TODO: Integrate tiktoken for accurate counting
    return estimateTokenCount(content);
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
    ];
  }
}
