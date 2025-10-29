import type { LLMProvider } from './provider';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

/**
 * LLM Provider Factory
 * Selects the appropriate provider based on model name
 */
export class LLMFactory {
  private static openaiProvider: OpenAIProvider | null = null;
  private static anthropicProvider: AnthropicProvider | null = null;

  /**
   * Get the appropriate LLM provider for a given model
   */
  static getProvider(model: string): LLMProvider {
    if (model.startsWith('gpt-') || model.includes('turbo')) {
      if (!this.openaiProvider) {
        this.openaiProvider = new OpenAIProvider();
      }
      return this.openaiProvider;
    }

    if (model.startsWith('claude-') || model.includes('sonnet') || model.includes('haiku')) {
      if (!this.anthropicProvider) {
        this.anthropicProvider = new AnthropicProvider();
      }
      return this.anthropicProvider;
    }

    // Default to OpenAI for unknown models
    if (!this.openaiProvider) {
      this.openaiProvider = new OpenAIProvider();
    }
    return this.openaiProvider;
  }

  /**
   * Check if a model is supported
   */
  static isModelSupported(model: string): boolean {
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();

    return (
      openai.getSupportedModels().includes(model) ||
      anthropic.getSupportedModels().includes(model)
    );
  }

  /**
   * Get all supported models across all providers
   */
  static getAllSupportedModels(): string[] {
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();

    return [...openai.getSupportedModels(), ...anthropic.getSupportedModels()];
  }

  /**
   * Reset provider instances (useful for testing)
   */
  static resetProviders(): void {
    this.openaiProvider = null;
    this.anthropicProvider = null;
  }
}
