/**
 * Make LLM chat calls with retry + exponential backoff + timeout.
 * Transient errors (network, 429, 5xx) are retried automatically.
 * Calls timeout after `timeoutMs` (default: 60s) to prevent indefinite hangs.
 */
import { ChatMessage } from './types';
import { ProviderFactory } from '../llm';

export interface LlmCallOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

export class LlmCall {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly timeoutMs: number;

  constructor(
    private llm: ProviderFactory,
    opts: LlmCallOptions = {}
  ) {
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 1000;
    this.maxDelayMs = opts.maxDelayMs ?? 10000;
    this.timeoutMs = opts.timeoutMs ?? 60000;
  }

  /**
   * Call the LLM with messages, retrying on transient failures.
   * Times out after `timeoutMs` (default 60s).
   * @throws LLMError after all retries exhausted or timeout
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.withTimeout(this.llm.chat(messages), this.timeoutMs);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!this.isRetryable(lastError)) {
          throw lastError; // non-transient, don't retry
        }

        if (attempt === this.maxRetries) {
          throw lastError; // exhausted retries
        }

        const delay = Math.min(this.baseDelayMs * 2 ** attempt, this.maxDelayMs);
        console.warn(`[LlmCall:retry] attempt ${attempt + 1} failed (${lastError.message.slice(0, 80)}). Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message.toLowerCase();
    // Network errors
    if (msg.includes('econnreset') || msg.includes('timeout') || msg.includes('enotfound')) return true;
    // HTTP 429 (rate limit) or 5xx
    if (/\b(429|500|502|503|504)\b/.test(msg)) return true;
    // OpenAI specific overload errors
    if (msg.includes('reduce')) return true;
    return false;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const result = await Promise.race([
        promise.finally(() => clearTimeout(timeout)),
        new Promise<T>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error(`LLM call timed out after ${ms}ms`));
          });
        })
      ]);
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}