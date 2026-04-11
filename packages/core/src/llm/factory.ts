import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ChatMessage } from '../agent/types';
import { ProviderConfig } from './config';
import { Provider } from './constants';
import { defaultBaseUrl, defaultModel } from './defaults';

export class ProviderFactory {
  constructor(private cfg: ProviderConfig) {
    // Fail fast if apiKey is missing for providers that require it.
    // Ollama-based providers and openai-compatible endpoints may omit it (local auth).
    if (!cfg.apiKey && !['ollama', 'ollama-cloud'].includes(cfg.provider)) {
      throw new Error(
        `Provider "${cfg.provider}" requires an API key but none was provided. ` +
        `Set LLM_API_KEY (or provider.apiKey in config).`
      );
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    switch (this.cfg.provider) {
      case 'openai': return this.chatOpenAICompatible(messages);
      case 'anthropic': return this.chatAnthropic(messages);
      case 'ollama': return this.chatOllama(messages);
      case 'ollama-cloud': return this.chatOllamaCloud(messages);
      case 'gemini': return this.chatGemini(messages);
      case 'deepseek': return this.chatDeepSeek(messages);
      case 'cohere': return this.chatCohere(messages);
      case 'mistral': return this.chatMistral(messages);
      case 'perplexity': return this.chatPerplexity(messages);
      case 'together': return this.chatTogether(messages);
      case 'groq': return this.chatGroq(messages);
      case 'grok': return this.chatGrok(messages);
      case 'minimax': return this.chatMinimax(messages);
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
    if (!this.cfg.apiKey) throw new Error('API key not configured');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
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

  // ── Ollama (local) ──────────────────────────────────────────────
  private async chatOllama(messages: ChatMessage[]): Promise<string> {
    const ollama = new Ollama({ host: this.cfg.baseUrl || 'http://localhost:11434' });
    const chatMsgs = this.chatMsgs(messages);
    const resp = await ollama.chat({
      model: this.cfg.model || 'llama3.1',
      messages: chatMsgs as Array<{ role: string; content: string }>,
    });
    return resp.message.content;
  }

  // ── Ollama Cloud (https://ollama.com/v1 - OpenAI-compatible) ───
  private async chatOllamaCloud(messages: ChatMessage[]): Promise<string> {
    return this.chatOpenAICompatible(messages);
  }

  private async chatGemini(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.cfg.apiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const model = 'gemini-2.0-flash';
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

    const res = await axios.post(url, body, { timeout: 60000 });
    const candidate = res.data?.candidates?.[0];
    return candidate?.content?.parts?.[0]?.text || '';
  }

  private async chatDeepSeek(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.deepseek.com';
    if (!this.cfg.apiKey) throw new Error('API key not configured');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
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

  // ── Groq (OpenAI-compatible) ──────────────────────────────────
  private async chatGroq(messages: ChatMessage[]): Promise<string> {
    return this.chatOpenAICompatible(messages);
  }

  // ── Grok (xAI, OpenAI-compatible) ──────────────────────────────
  private async chatGrok(messages: ChatMessage[]): Promise<string> {
    return this.chatOpenAICompatible(messages);
  }

  // ── MiniMax (OpenAI-compatible) ───────────────────────────────
  private async chatMinimax(messages: ChatMessage[]): Promise<string> {
    return this.chatOpenAICompatible(messages);
  }

  // ── Cohere ────────────────────────────────────────────────────
  private async chatCohere(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.cfg.apiKey || process.env.COHERE_API_KEY || '';
    if (!apiKey) throw new Error('COHERE_API_KEY not set');
    const model = this.cfg.model || 'command-r-plus';
    const url = `https://api.cohere.ai/v1/chat`;

    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);

    const body: Record<string, unknown> = {
      model,
      messages: chatMsgs,
      temperature: 0.7,
    };
    if (system) body.system_prompt = system;

    const res = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
    const text = res.data?.text || res.data?.chat_history?.slice(-1)?.[0]?.content || '';
    return text;
  }

  // ── Mistral ───────────────────────────────────────────────────
  private async chatMistral(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.mistral.ai/v1';
    if (!this.cfg.apiKey) throw new Error('MISTRAL_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'mistral-large-latest',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── Perplexity (OpenAI-compatible) ─────────────────────────────
  private async chatPerplexity(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.perplexity.ai';
    if (!this.cfg.apiKey) throw new Error('PERPLEXITY_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'sonar',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── Together AI ────────────────────────────────────────────────
  private async chatTogether(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.together.xyz/v1';
    if (!this.cfg.apiKey) throw new Error('TOGETHER_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/Llama-3-70b-chat-hf',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system } as const] : []),
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