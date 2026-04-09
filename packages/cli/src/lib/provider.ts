import { ProviderConfig } from '@nyxmind/core';

export function getProviderConfigFromEnv(): ProviderConfig {
  return {
    provider: (process.env.LLM_PROVIDER as ProviderConfig['provider']) || 'openai',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  };
}
