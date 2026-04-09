import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ChatMessage } from '../agent/types';
import { ProviderConfig } from './config';
import { Provider } from './constants';
import { defaultBaseUrl, defaultModel } from './defaults';

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
    const baseURL = this.cfg.baseUrl || defaultBaseUrl(this.cfg.provider);
    const client = new OpenAI({ apiKey: this.cfg.apiKey || 'dummy', baseURL });
    const resp = await client.chat.completions.create({
      model: this.cfg.model || defaultModel(this.cfg.provider),
      messages: messages as unknown as OpenAI.Chat.ChatCompletionMessage[],
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
      messages: chatMsgs as Anthropic.Messages.MessageParam[],
    });
    return resp.content[0]?.type === 'text' ? resp.content[0].text : '';
  }

  private async chatOllama(messages: ChatMessage[]): Promise<string> {
    const ollama = new Ollama({ host: this.cfg.baseUrl || 'http://localhost:11434' });
    const chatMsgs = this.chatMsgs(messages);
    const resp = await ollama.chat({
      model: this.cfg.model || 'llama3.1',
      messages: chatMsgs as Array<{ role: string; content: string }>,
    });
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

    const body: Record<string, unknown> = { contents };
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
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  getModelName(): string {
    return this.cfg.model || defaultModel(this.cfg.provider);
  }

  getProvider(): Provider {
    return this.cfg.provider;
  }
}
