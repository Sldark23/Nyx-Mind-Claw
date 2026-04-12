import { z } from 'zod';
import { Provider } from './constants';

export const ProviderConfigSchema = z.object({
  provider: z.enum([
    'openai', 'groq', 'grok', 'minimax',
    'anthropic', 'ollama', 'ollama-cloud', 'gemini', 'deepseek',
    'cohere', 'mistral', 'perplexity', 'together',
  ]),
  apiKey: z.string().default(''),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
}).superRefine((cfg, ctx) => {
  // Fail fast if apiKey is missing for providers that require it.
  // Ollama-based providers and openai-compatible endpoints may omit it (local auth).
  if (!cfg.apiKey && !['ollama', 'ollama-cloud'].includes(cfg.provider)) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: 'string',
      received: 'undefined',
      message: `Provider "${cfg.provider}" requires an API key. Set LLM_API_KEY or provider.apiKey in config.`,
    });
  }
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export function validateConfig(cfg: unknown): ProviderConfig {
  const result = ProviderConfigSchema.safeParse(cfg);
  if (!result.success) {
    for (const issue of result.error.issues) {
      console.warn(`[config] invalid "${issue.path.join('.')}" (${issue.code}): ${issue.message}`);
    }
    // Attempt with defaults applied to problematic fields
    const issues = result.error.issues;
    const defaulted = { ...cfg as Record<string, unknown> };
    for (const issue of issues) {
      const key = issue.path[0] as string;
      if (key in defaulted) {
        delete defaulted[key];
      }
    }
    const retry = ProviderConfigSchema.safeParse({ ...defaulted });
    if (retry.success) return retry.data;
    return { provider: 'openai', apiKey: '' };
  }
  return result.data;
}

export function configFromEnv(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER || 'openai') as Provider;
  return validateConfig({
    provider,
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  });
}