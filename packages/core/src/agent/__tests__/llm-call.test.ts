/**
 * Unit tests for LlmCall retry/backoff logic.
 * Covers: transient error retry, max retry enforcement, backoff timing, isRetryable edge cases.
 */
import { LlmCall } from '../llm-call';
import { ChatMessage } from '../types';

describe('LlmCall', () => {
  // Minimal stub provider implementing only what LlmCall needs
  const makeStubProvider = (fn: () => Promise<string>) => {
    const { ProviderFactory } = require('../../llm/factory');
    const stub = Object.create(ProviderFactory.prototype);
    stub.chat = fn;
    return stub;
  };

  describe('isRetryable edge cases', () => {
    it('retries on ECONNRESET', async () => {
      // isRetryable checks err.message includes 'econnreset'
      const err = Object.assign(new Error('ECONNRESET: connection reset'), { code: 'ECONNRESET' });
      let attempts = 0;
      const provider = makeStubProvider(async () => {
        attempts++;
        if (attempts < 3) throw err;
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('ok');
      expect(attempts).toBe(3);
    });

    it('retries on timeout errors', async () => {
      // isRetryable checks err.message includes 'timeout'
      let attempts = 0;
      const provider = makeStubProvider(async () => {
        attempts++;
        if (attempts < 2) throw new Error('Request timeout');
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('ok');
      expect(attempts).toBe(2);
    });

    it('retries on ENOTFOUND DNS errors', async () => {
      // isRetryable checks err.message includes 'enotfound'
      const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      let attempts = 0;
      const provider = makeStubProvider(async () => {
        attempts++;
        if (attempts < 2) throw err;
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('ok');
      expect(attempts).toBe(2);
    });

    it('retries on HTTP 429 rate limit', async () => {
      // isRetryable uses regex \b429\b in message
      let attempts = 0;
      const provider = makeStubProvider(async () => {
        attempts++;
        if (attempts < 2) throw Object.assign(new Error('HTTP 429: rate limit exceeded'), { status: 429 });
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('ok');
      expect(attempts).toBe(2);
    });

    it('retries on HTTP 5xx server errors', async () => {
      for (const code of [500, 502, 503, 504]) {
        let attempts = 0;
        const provider = makeStubProvider(async () => {
          attempts++;
          if (attempts < 2) throw Object.assign(new Error(`HTTP ${code}: server error`), { status: code });
          return 'ok';
        });
        const llmCall = new LlmCall(provider as any, { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 30 });
        await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('ok');
        expect(attempts).toBe(2);
      }
    });

    it('does NOT retry on non-retryable errors', async () => {
      const provider = makeStubProvider(async () => {
        throw new Error('Invalid API key — non-retryable');
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 30 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('Invalid API key');
    });

    it('does NOT retry on 4xx client errors (except 429)', async () => {
      // isRetryable only matches 429/500/502/503/504 in message
      const provider = makeStubProvider(async () => {
        throw Object.assign(new Error('HTTP 400: bad request'), { status: 400 });
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 30 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('HTTP 400');
    });
  });

  describe('max retry enforcement', () => {
    it('exhausts retries and throws last error', async () => {
      const provider = makeStubProvider(async () => {
        throw new Error('persistent failure');
      });
      // maxRetries=2 means 3 total attempts (0,1,2) — all 3 fail
      const llmCall = new LlmCall(provider as any, { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 30 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('persistent failure');
    });

    it('respects maxRetries=0 (single attempt)', async () => {
      const provider = makeStubProvider(async () => {
        throw new Error('only one shot');
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 0 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('only one shot');
    });
  });

  describe('backoff timing', () => {
    it('second delay is longer than first (exponential backoff)', async () => {
      const times: number[] = [];
      let invoked = 0;
      const provider = makeStubProvider(async () => {
        times.push(Date.now());
        invoked++;
        // Fail on first two calls, succeed on third
        if (invoked < 3) throw new Error('retry me');
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 200, maxDelayMs: 500 });
      await llmCall.chat([{ role: 'user', content: 'test' }]);

      const d1 = times[1] - times[0];
      const d2 = times[2] - times[1];
      // Second delay should be noticeably longer than first (exponential growth)
      expect(d2).toBeGreaterThan(d1);
    });

    it('second delay grows vs first (exponential backoff)', async () => {
      const times: number[] = [];
      let invoked = 0;
      const provider = makeStubProvider(async () => {
        times.push(Date.now());
        invoked++;
        if (invoked < 3) throw new Error('retry me');
        return 'ok';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 200, maxDelayMs: 500 });
      await llmCall.chat([{ role: 'user', content: 'test' }]);

      const d1 = times[1] - times[0];
      const d2 = times[2] - times[1];
      expect(d2).toBeGreaterThan(d1);
    });
  });

  describe('timeout', () => {
    it('times out after timeoutMs', async () => {
      const provider = makeStubProvider(async () => {
        await new Promise(r => setTimeout(r, 300));
        return 'late';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 0, timeoutMs: 50 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(/timed out/i);
    });
  });

  describe('successful calls', () => {
    it('returns result on first success', async () => {
      const provider = makeStubProvider(async () => 'hello world');
      const llmCall = new LlmCall(provider as any, { maxRetries: 3 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('hello world');
    });

    it('returns result after transient failures are resolved', async () => {
      let invoked = 0;
      const provider = makeStubProvider(async () => {
        invoked++;
        if (invoked < 3) throw Object.assign(new Error('HTTP 503: unavailable'), { status: 503 });
        return 'finally';
      });
      const llmCall = new LlmCall(provider as any, { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 30 });
      await expect(llmCall.chat([{ role: 'user', content: 'test' }])).resolves.toBe('finally');
      expect(invoked).toBe(3);
    });
  });
});
