/**
 * Make LLM chat calls with retry + exponential backoff.
 * Transient errors (network, 429, 5xx) are retried automatically.
 */
import { ChatMessage } from './types';
import { ProviderFactory } from '../llm';

export interface LlmCallOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class LlmCall {
  constructor(
    private llm: ProviderFactory,
    private opts: LlmCallOptions = {}
  ) {
    this.opts = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      ...opts,
    };
  }

  /**
   * Call the LLM with messages, retrying on transient failures.
   * @throws LLMError after all retries exhausted
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    const { maxRetries, baseDelayMs, maxDelayMs } = this.opts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await this.llm.chat(messages);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!this.isRetryable(lastError)) {
          throw lastError; // non-transient, don't retry
        }

        if (attempt === maxRetries) {
          throw lastError; // exhausted retries
        }

        const delay = Math.min(baseDelayMs! * 2 ** attempt, maxDelayMs!);
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
    // OpenAI specific
    if (msg.includes('reduce') || msg.includes('timeout')) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
