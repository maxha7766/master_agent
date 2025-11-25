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
    // GPT-5 and o-series models have different parameter requirements
    const isGPT5 = model.startsWith('gpt-5');
    const isO1 = model.startsWith('o1');
    const useNewParams = isGPT5 || isO1;

    const params: any = {
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: false,
    };

    // GPT-5 and o1 models use max_completion_tokens instead of max_tokens
    if (useNewParams) {
      if (options.maxTokens) {
        params.max_completion_tokens = options.maxTokens;
      }
      // Don't add temperature or top_p for these models
    } else {
      params.temperature = options.temperature ?? 0.7;
      if (options.maxTokens) {
        params.max_tokens = options.maxTokens;
      }
      if (options.topP !== undefined) {
        params.top_p = options.topP;
      }
    }

    const response = await this.client.chat.completions.create(params);

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
    // GPT-5 and o-series models have different parameter requirements
    const isGPT5 = model.startsWith('gpt-5');
    const isO1 = model.startsWith('o1');
    const useNewParams = isGPT5 || isO1;

    const params: any = {
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true,
    };

    // GPT-5 and o1 models use max_completion_tokens instead of max_tokens
    if (useNewParams) {
      if (options.maxTokens) {
        params.max_completion_tokens = options.maxTokens;
      }
      // Don't add temperature or top_p for these models
    } else {
      params.temperature = options.temperature ?? 0.7;
      if (options.maxTokens) {
        params.max_tokens = options.maxTokens;
      }
      if (options.topP !== undefined) {
        params.top_p = options.topP;
      }
    }

    const stream = await this.client.chat.completions.create(params) as unknown as AsyncIterable<any>;

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
      // GPT-5 Series (Latest - November 2025)
      'gpt-5.1',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      // GPT-4 Series
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      // GPT-3.5 Series
      'gpt-3.5-turbo',
      // Reasoning Models
      'o1',
    ];
  }
}
