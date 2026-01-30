/**
 * Exponential backoff retry utility for transient failures
 */

import { createChildLogger } from '../utils/index.js';

const log = createChildLogger('media:retry');

/** Options for retry behavior */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

const TRANSIENT_PATTERNS = [
  'timeout',
  'rate limit',
  '503',
  '429',
  'econnreset',
  'etimedout',
];

/**
 * Check if error is transient and worth retrying
 */
export function isTransientError(err: Error): boolean {
  const message = err.message.toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Execute function with exponential backoff retry
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of successful execution
 * @throws Last error if all retries exhausted or non-transient error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Non-transient errors fail immediately
      if (!isTransientError(lastError)) {
        throw lastError;
      }

      // Last attempt - don't delay, just throw
      if (attempt === maxRetries - 1) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      log.info(
        { attempt: attempt + 1, maxRetries, delayMs, error: lastError.message },
        'retrying after transient error'
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
