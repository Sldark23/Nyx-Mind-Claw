import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ChatMessage } from './types';
import { z } from 'zod';

export type Provider = 'openai' | 'groq' | 'grok' | 'minimax' | 'anthropic' | 'ollama' | 'gemini' | 'deepseek';

const ProviderConfigSchema = z.object({
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

export class ProviderFactory {
  constructor(private cfg: ProviderConfig) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    switch (this.cfg.provider) {
      case 'anthropic': return this.chatAnthropic(messages);
      case 'ollama': return this.chatOllama(messages);
      case 'gemini': return this.chatGemini(messages);
      case 'deepseek': return this.chatDeepSeek(messages);
      default: return this.chatOpenAICompatible(messages);
    }
  }

  private systemMsg(messages: ChatMessage[]): string | undefined {
    return messages.find(m => m.role === 'system')?.content;
  }

  private chatMsgs(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }));
  }

  private async chatOpenAICompatible(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || this.defaultBaseUrl(this.cfg.provider!);
    const client = new OpenAI({ apiKey: this.cfg.apiKey || 'dummy', baseURL });
    const resp = await client.chat.completions.create({
      model: this.cfg.model || this.defaultModel(this.cfg.provider!),
      messages: messages as any,
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: ChatMessage[]): Promise<string> {
    const client = new Anthropic({ apiKey: this.cfg.apiKey || '' });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.messages.create({
      model: this.cfg.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system,
      messages: chatMsgs as any,
    });
    return resp.content[0]?.text || '';
  }

  private async chatOllama(messages: ChatMessage[]): Promise<string> {
    const ollama = new Ollama({ host: this.cfg.baseUrl || 'http://localhost:11434' });
    const resp = await ollama.chat({ model: this.cfg.model || 'llama3.1', messages: messages as any });
    return resp.message.content;
  }

  private async chatGemini(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.cfg.apiKey || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const model = this.cfg.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);

    const contents = chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: any = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    body.generationConfig = { temperature: 0.7 };

    const res = await axios.post(url, body, { timeout: 120000 });
    const candidate = res.data?.candidates?.[0];
    return candidate?.content?.parts?.[0]?.text || '';
  }

  private async chatDeepSeek(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.deepseek.com';
    const client = new OpenAI({ apiKey: this.cfg.apiKey || '', baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'deepseek-chat',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as any,
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  private defaultBaseUrl(provider: Provider): string | undefined {
    switch (provider) {
      case 'groq': return 'https://api.groq.com/openai/v1';
      case 'grok': return 'https://api.x.ai/v1';
      case 'minimax': return 'https://api.minimax.chat/v1';
      case 'deepseek': return 'https://api.deepseek.com';
      default: return undefined;
    }
  }

  private defaultModel(provider: Provider): string {
    switch (provider) {
      case 'groq': return 'llama-3.1-70b-versatile';
      case 'grok': return 'grok-2-1212';
      case 'minimax': return 'abab6.5s-chat';
      default: return 'gpt-4o-mini';
    }
  }

  getModelName(): string {
    return this.cfg.model || this.defaultModel(this.cfg.provider);
  }

  getProvider(): Provider {
    return this.cfg.provider;
  }
}
