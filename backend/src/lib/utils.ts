/**
 * Shared utility functions
 */

/**
 * Sleep for a specified duration
 * @param ms Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts (default: 3)
 * @param baseDelay Base delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff: baseDelay * 2^(attempt - 1)
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Estimate token count for a string
 * Simple approximation: 1 token ≈ 4 characters
 * For accurate counting, use tiktoken library
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens (async version for compatibility)
 */
export async function countTokens(content: string, _model: string): Promise<number> {
  // For now, use simple estimation
  // TODO: Replace with tiktoken when implementing proper token counting
  return estimateTokenCount(content);
}

/**
 * Count tokens more accurately using word-based estimation
 * More accurate than character-based, but still an approximation
 * 1 token ≈ 0.75 words for English text
 */
export function estimateTokenCountByWords(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return Math.ceil(words.length / 0.75);
}

/**
 * Truncate text to a maximum token count
 * @param text Text to truncate
 * @param maxTokens Maximum number of tokens
 * @returns Truncated text
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Approximate characters to keep
  const charsToKeep = maxTokens * 4;
  return text.substring(0, charsToKeep) + '...';
}

/**
 * Format a timestamp as ISO 8601 string
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Parse a month string (YYYY-MM) to Date
 */
export function parseMonth(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number);
  return new Date(year, monthNum - 1, 1);
}

/**
 * Get current month string (YYYY-MM)
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Sanitize string for safe logging (remove sensitive data)
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'api_key', 'apiKey', 'secret', 'connectionString'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Calculate cost based on token usage and model pricing
 * Prices are per 1,000 tokens (as of November 2025)
 */
export function calculateLLMCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    // Claude Models (prices per 1M tokens converted to per 1K)
    'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 }, // $3/$15 per 1M
    'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
    'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },

    // GPT-5 Series (prices per 1M tokens converted to per 1K)
    'gpt-5.1': { input: 0.00125, output: 0.01 }, // $1.25/$10 per 1M
    'gpt-5.1-chat-latest': { input: 0.00125, output: 0.01 },
    'gpt-5.1-codex': { input: 0.00125, output: 0.01 },
    'gpt-5.1-codex-mini': { input: 0.0005, output: 0.004 }, // Estimated cheaper
    'gpt-5': { input: 0.00125, output: 0.01 },
    'gpt-5-mini': { input: 0.0005, output: 0.004 }, // Estimated cheaper
    'gpt-5-nano': { input: 0.0002, output: 0.0015 }, // Estimated cheapest

    // GPT-4 Series (Legacy)
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },

    // Embeddings
    'text-embedding-3-large': { input: 0.00013, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4']; // Default to GPT-4 if unknown

  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}
