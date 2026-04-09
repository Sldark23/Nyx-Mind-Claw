import { z } from 'zod';
import { Provider } from './constants';

export const ProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'groq', 'grok', 'minimax', 'anthropic', 'ollama', 'gemini', 'deepseek']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
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
