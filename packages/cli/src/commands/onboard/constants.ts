export const PROVIDERS = [
  'openai', 'anthropic', 'groq', 'grok', 'minimax',
  'deepseek', 'cohere', 'mistral', 'perplexity',
  'together', 'ollama', 'ollama-cloud', 'gemini',
  'fireworks', 'novita',
] as const;

export type ProviderName = typeof PROVIDERS[number];

// Curated model lists per provider — shown during onboard
// "Custom..." option is appended automatically for free-text entry
export const PROVIDER_MODELS: Record<ProviderName, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma-2-9b-it',
  ],
  grok: [
    'grok-2-1212',
    'grok-2-mini-1212',
    'grok-beta',
  ],
  minimax: [
    'minimax-mini',
    'minimax-speech-02',
    'abab6.5s',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner',
  ],
  cohere: [
    'command-r-plus',
    'command-r',
    'command',
  ],
  mistral: [
    'mistral-large-2411',
    'mistral-small-2507',
    'codestral-2501',
    'mixtral-8x22b',
  ],
  perplexity: [
    'llama-3.1-sonar-large-128k-online',
    'llama-3.1-sonar-small-128k-online',
    'sonar',
  ],
  together: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'meta-llama/Llama-3.1-8B-Instruct-Turbo',
    'mistralai/Mixtral-8x22B-Instruct-v0.1',
    'deepseek-ai/DeepSeek-V3',
  ],
  ollama: [
    // Default Ollama models — user can still enter custom
    'llama3.3',
    'llama3.2',
    'llama3.1',
    'mistral',
    'codellama',
    'phi',
  ],
  'ollama-cloud': [
    // Ollama Cloud shares same model naming
    'llama3.3',
    'llama3.2',
    'llama3.1',
    'mistral',
    'codellama',
    'phi',
    'qwen2.5',
    'deepseek-v3',
    'wizardlm2',
  ],
  fireworks: [
    'fireworks-ai/fw-llama-3-3-70b-instruct',
    'fireworks-ai/fw-llama-3-1-405b-instruct',
    'fireworks-ai/fw-llama-3-1-70b-instruct',
    'fireworks-ai/fw-llama-3-2-90b-instruct',
    'fireworks-ai/llama-3-2-vision-90b',
  ],
  novita: [
    'novita/llama-3-3-70b-instruct',
    'novita/llama-3-1-405b-instruct',
    'novita/llama-3-1-70b-instruct',
    'novita/deepseek-v3-7b',
    'novita/codellama-70b-instruct',
  ],
  gemini: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
  ],
};
