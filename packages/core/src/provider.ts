import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import { ChatMessage } from './types';

export type Provider = 'openai' | 'groq' | 'grok' | 'minimax' | 'anthropic' | 'ollama';

export interface ProviderConfig {
  provider: Provider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class ProviderFactory {
  constructor(private cfg: ProviderConfig) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    switch (this.cfg.provider) {
      case 'anthropic':
        return this.chatAnthropic(messages);
      case 'ollama':
        return this.chatOllama(messages);
      default:
        return this.chatOpenAI(messages);
    }
  }

  private async chatOpenAI(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || this.defaultBaseUrl(this.cfg.provider);
    const client = new OpenAI({ apiKey: this.cfg.apiKey || '', baseURL });
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'gpt-4o-mini',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: ChatMessage[]): Promise<string> {
    const client = new Anthropic({ apiKey: this.cfg.apiKey || '' });
    const system = messages.find(m => m.role === 'system')?.content || '';
    const rest = messages.filter(m => m.role !== 'system');
    const resp = await client.messages.create({
      model: this.cfg.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system,
      messages: rest.map(m => ({ role: m.role as any, content: m.content })),
    });
    return resp.content[0]?.text || '';
  }

  private async chatOllama(messages: ChatMessage[]): Promise<string> {
    const ollama = new Ollama({ host: this.cfg.baseUrl || 'http://localhost:11434' });
    const resp = await ollama.chat({ model: this.cfg.model || 'llama3.1', messages });
    return resp.message.content;
  }

  private defaultBaseUrl(provider: Provider) {
    if (provider === 'groq') return 'https://api.groq.com/openai/v1';
    if (provider === 'grok') return 'https://api.x.ai/v1';
    if (provider === 'minimax') return 'https://api.minimax.chat/v1';
    return undefined;
  }
}
