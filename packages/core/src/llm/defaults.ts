import { Provider } from './constants';

export function defaultBaseUrl(provider: Provider): string | undefined {
  switch (provider) {
    case 'groq':       return 'https://api.groq.com/openai/v1';
    case 'grok':       return 'https://api.x.ai/v1';
    case 'minimax':    return 'https://api.minimax.chat/v1';
    case 'deepseek':   return 'https://api.deepseek.com';
    case 'cohere':     return 'https://api.cohere.ai/v1';
    case 'mistral':    return 'https://api.mistral.ai/v1';
    case 'perplexity': return 'https://api.perplexity.ai';
    case 'together':   return 'https://api.together.xyz/v1';
    default:           return undefined;
  }
}

export function defaultModel(provider: Provider): string {
  switch (provider) {
    case 'openai':     return 'gpt-4o-mini';
    case 'anthropic':   return 'claude-3-5-sonnet-20241022';
    case 'ollama':      return 'llama3.1';
    case 'groq':        return 'llama-3.1-70b-versatile';
    case 'grok':        return 'grok-2-1212';
    case 'minimax':     return 'abab6.5s-chat';
    case 'gemini':      return 'gemini-2.0-flash';
    case 'deepseek':    return 'deepseek-chat';
    case 'cohere':      return 'command-r-plus';
    case 'mistral':     return 'mistral-large-latest';
    case 'perplexity':  return 'sonar';
    case 'together':    return 'meta-llama/Llama-3-70b-chat-hf';
    default:            return 'gpt-4o-mini';
  }
}