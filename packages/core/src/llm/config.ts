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
  return ProviderConfigSchema.parse(cfg);
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