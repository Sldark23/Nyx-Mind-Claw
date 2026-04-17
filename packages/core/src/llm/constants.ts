export type Provider =
  | 'openai' | 'groq' | 'grok' | 'minimax'
  | 'anthropic' | 'ollama' | 'ollama-cloud' | 'gemini' | 'deepseek'
  | 'cohere' | 'mistral' | 'perplexity' | 'together'
  | 'replicate' | 'anyscale' | 'novita' | 'samba';

export const PROVIDERS = [
  'openai', 'anthropic', 'groq', 'grok', 'minimax',
  'deepseek', 'cohere', 'mistral', 'perplexity',
  'together', 'ollama', 'ollama-cloud', 'gemini',
  'replicate', 'anyscale', 'novita', 'samba',
] as const;