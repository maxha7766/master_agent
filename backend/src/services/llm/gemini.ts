import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
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
 * Google Gemini LLM Provider
 * Supports Gemini 3 models with thinking mode
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    this.client = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '');
  }

  /**
   * Convert chat messages to Gemini format
   */
  private convertMessages(messages: ChatMessage[]) {
    const systemMessage = messages.find((msg) => msg.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    return { systemMessage, conversationMessages };
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
            input: 0,
            output: 0,
            total: 0,
          },
          finishReason: 'cache_hit',
        };
      }
    }

    const { systemMessage, conversationMessages } = this.convertMessages(messages);

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage || undefined,
    });

    const chat = generativeModel.startChat({
      history: conversationMessages.slice(0, -1),
      generationConfig: {
        temperature,
        topP: options.topP,
        maxOutputTokens: options.maxTokens || 8192,
      },
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    const response = result.response;
    const content = response.text();

    // Cache the response if appropriate
    if (shouldCache && content) {
      llmCache.set(messages, model, temperature, content);
    }

    return {
      content,
      model,
      tokensUsed: {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
        total: response.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: response.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    model: string,
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const { systemMessage, conversationMessages } = this.convertMessages(messages);

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage || undefined,
    });

    const chat = generativeModel.startChat({
      history: conversationMessages.slice(0, -1),
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        topP: options.topP,
        maxOutputTokens: options.maxTokens || 8192,
      },
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.parts);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      yield {
        content: text,
        done: false,
      };
    }

    yield {
      content: '',
      done: true,
    };
  }

  async countTokens(content: string, _model: string): Promise<number> {
    // Use estimation as fallback
    return estimateTokenCount(content);
  }

  getSupportedModels(): string[] {
    return [
      'gemini-3.0-flash-thinking-exp',
      'gemini-3.0-flash-thinking-exp-1219',
      'gemini-2.0-flash-exp',
      'gemini-exp-1206',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-thinking-exp-1219',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];
  }
}
