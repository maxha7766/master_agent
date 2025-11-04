/**
 * LLM Provider Interface
 * Abstraction for different LLM providers (OpenAI, Anthropic, etc.)
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  finishReason: string;
}

export interface SourceMetadata {
  rag?: Array<{
    documentId: string;
    fileName: string;
    pages?: number[];
    chunkCount: number;
  }>;
  tabular?: Array<{
    documentId: string;
    fileName: string;
    rowCount: number;
  }>;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  sources?: SourceMetadata; // Optional metadata about sources used
}

/**
 * LLM Provider Interface
 */
export interface LLMProvider {
  /**
   * Provider name (e.g., 'openai', 'anthropic')
   */
  readonly name: string;

  /**
   * Generate a chat completion (non-streaming)
   */
  chat(
    messages: ChatMessage[],
    model: string,
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;

  /**
   * Generate a streaming chat completion
   */
  chatStream(
    messages: ChatMessage[],
    model: string,
    options?: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Count tokens in a message
   * Returns approximate count if exact counting not available
   */
  countTokens(content: string, _model: string): Promise<number>;

  /**
   * Get models supported by this provider
   */
  getSupportedModels(): string[];
}
