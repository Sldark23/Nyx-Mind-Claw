import { Provider } from './constants';

export function defaultBaseUrl(provider: Provider): string | undefined {
  switch (provider) {
    case 'groq': return 'https://api.groq.com/openai/v1';
    case 'grok': return 'https://api.x.ai/v1';
    case 'minimax': return 'https://api.minimax.chat/v1';
    case 'deepseek': return 'https://api.deepseek.com';
    default: return undefined;
  }
}

export function defaultModel(provider: Provider): string {
  switch (provider) {
    case 'groq': return 'llama-3.1-70b-versatile';
    case 'grok': return 'grok-2-1212';
    case 'minimax': return 'abab6.5s-chat';
    default: return 'gpt-4o-mini';
  }
}
