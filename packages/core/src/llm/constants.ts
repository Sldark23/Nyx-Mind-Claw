export type Provider =
  | 'openai' | 'groq' | 'grok' | 'minimax'
  | 'anthropic' | 'ollama' | 'gemini' | 'deepseek'
  | 'cohere' | 'mistral' | 'perplexity' | 'together';

export const PROVIDERS = [
  'openai', 'anthropic', 'groq', 'grok', 'minimax',
  'deepseek', 'cohere', 'mistral', 'perplexity',
  'together', 'ollama', 'gemini',
] as const;