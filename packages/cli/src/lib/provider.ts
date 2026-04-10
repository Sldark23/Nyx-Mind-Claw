import { ProviderConfig, getLlmConfig } from '@nyxmind/core';

export function getProviderConfigFromEnv(): ProviderConfig {
  const cfg = getLlmConfig();
  return {
    provider: cfg.provider,
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
  };
}
