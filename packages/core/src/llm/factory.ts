import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ChatMessage } from '../agent/types';
import { ProviderConfig } from './config';
import { Provider } from './constants';
import { defaultBaseUrl, defaultModel } from './defaults';

const DEFAULT_TIMEOUT_MS = 60_000; // 60s

/**
 * Wrap a promise with an AbortSignal-based timeout.
 * If the timeout fires first, the returned promise rejects.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return promise
    .then(result => { clearTimeout(timeout); return result; })
    .catch(err => { clearTimeout(timeout); if (err instanceof Error && err.name === 'AbortError') throw new Error(`LLM call timed out after ${ms}ms`); throw err; });
}

export class ProviderFactory {
  constructor(private cfg: ProviderConfig) {
    // Fail fast if apiKey is missing for providers that require it.
    // Ollama-based providers, LMStudio, VLLM and openai-compatible endpoints may omit it (local auth).
    if (!cfg.apiKey && !['ollama', 'ollama-cloud', 'lmstudio', 'vllm'].includes(cfg.provider)) {
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
      case 'huggingface': return this.chatHuggingFace(messages);
      case 'cerebras': return this.chatCerebras(messages);
      case 'fireworks': return this.chatFireworks(messages);
      case 'openrouter': return this.chatOpenRouter(messages);
      case 'vllm': return this.chatVLLM(messages);
      case 'lmstudio': return this.chatLMStudio(messages);
      case 'azure': return this.chatAzure(messages);
      case 'dashscope': return this.chatDashScope(messages);
      case 'replicate': return this.chatReplicate(messages);
      case 'anyscale': return this.chatAnyscale(messages);
      case 'novita': return this.chatNovita(messages);
      case 'samba': return this.chatSamba(messages);
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
    const resp = await withTimeout(client.chat.completions.create({
      model: this.cfg.model || defaultModel(this.cfg.provider),
      messages: messages as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    }), DEFAULT_TIMEOUT_MS);
    return resp.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: ChatMessage[]): Promise<string> {
    const client = new Anthropic({ apiKey: this.cfg.apiKey || '' });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await withTimeout(client.messages.create({
      model: this.cfg.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system,
      messages: chatMsgs as Anthropic.Messages.MessageParam[],
    }), DEFAULT_TIMEOUT_MS);
    return resp.content[0]?.type === 'text' ? resp.content[0].text : '';
  }

  // ── Ollama (local) ──────────────────────────────────────────────
  private async chatOllama(messages: ChatMessage[]): Promise<string> {
    const ollama = new Ollama({ host: this.cfg.baseUrl || 'http://localhost:11434' });
    const chatMsgs = this.chatMsgs(messages);
    const resp = await withTimeout(ollama.chat({
      model: this.cfg.model || 'llama3.1',
      messages: chatMsgs as Array<{ role: string; content: string }>,
    }), DEFAULT_TIMEOUT_MS);
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
    const resp = await withTimeout(client.chat.completions.create({
      model: this.cfg.model || 'deepseek-chat',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    }), DEFAULT_TIMEOUT_MS);
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
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
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
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
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
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/Llama-3-70b-chat-hf',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── HuggingFace (OpenAI-compatible Inference API) ─────────────
  private async chatHuggingFace(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api-inference.huggingface.co/v1';
    if (!this.cfg.apiKey) throw new Error('HUGGINGFACE_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/Meta-Llama-3-70B-Instruct',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── Cerebras (OpenAI-compatible) ──────────────────────────────
  private async chatCerebras(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.cerebras.ai/v1';
    if (!this.cfg.apiKey) throw new Error('CEREBRAS_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'llama3.1-70b',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── Fireworks AI (OpenAI-compatible) ──────────────────────────
  private async chatFireworks(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.fireworks.ai/inference/v1';
    if (!this.cfg.apiKey) throw new Error('FIREWORKS_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── OpenRouter (OpenAI-compatible) ───────────────────────────
  private async chatOpenRouter(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://openrouter.ai/api/v1';
    if (!this.cfg.apiKey) throw new Error('OPENROUTER_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/llama-3.1-70b-instruct',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── VLLM (OpenAI-compatible local server) ─────────────────────
  private async chatVLLM(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'http://localhost:8000/v1';
    const client = new OpenAI({ apiKey: this.cfg.apiKey || 'vllm', baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/Llama-3-70b-chat-hf',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── LMStudio (OpenAI-compatible local server) ─────────────────
  private async chatLMStudio(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'http://localhost:1234/v1';
    const client = new OpenAI({ apiKey: this.cfg.apiKey || 'lmstudio', baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'local-model',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── Azure OpenAI (OpenAI-compatible) ──────────────────────────
  private async chatAzure(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl;
    if (!baseURL) throw new Error('AZURE_BASE_URL not set. Format: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}');
    if (!this.cfg.apiKey) throw new Error('AZURE_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'gpt-4o',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content || '';
  }

  // ── DashScope (Alibaba/Qwen, OpenAI-compatible) ───────────────
  private async chatDashScope(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    if (!this.cfg.apiKey) throw new Error('DASHSCOPE_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL, timeout: DEFAULT_TIMEOUT_MS });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await client.chat.completions.create({
      model: this.cfg.model || 'qwen-plus',
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

  // ── Replicate (https://api.replicate.com) ───────────────────────────
  private async chatReplicate(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.cfg.apiKey || process.env.REPLICATE_API_KEY || '';
    if (!apiKey) throw new Error('REPLICATE_API_KEY not set');
    const model = this.cfg.model || 'anthropic/claude-3.5-sonnet';
    const url = 'https://api.replicate.com/v1/chat';

    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);

    const body = {
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...chatMsgs,
      ],
      temperature: 0.7,
    };

    const res = await axios.post(url, body, {
      headers: { Authorization: `Token ${apiKey}` },
      timeout: DEFAULT_TIMEOUT_MS,
    });
    return res.data?.choices?.[0]?.message?.content || '';
  }

  // ── Anyscale (https://api.anyscale.com) ───────────────────────────
  private async chatAnyscale(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.anyscale.com/v1';
    if (!this.cfg.apiKey) throw new Error('ANYSCALE_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await withTimeout(client.chat.completions.create({
      model: this.cfg.model || 'meta-llama/Llama-3.1-70b-instruct',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    }), DEFAULT_TIMEOUT_MS);
    return resp.choices[0]?.message?.content || '';
  }

  // ── Novita AI (https://api.novita.ai) ────────────────────────────
  private async chatNovita(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.novita.ai/v1';
    if (!this.cfg.apiKey) throw new Error('NOVITA_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await withTimeout(client.chat.completions.create({
      model: this.cfg.model || 'novita/neural-chat-7b-preview',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    }), DEFAULT_TIMEOUT_MS);
    return resp.choices[0]?.message?.content || '';
  }

  // ── SambaNova (https://api.sambanova.ai) ────────────────────────
  private async chatSamba(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.cfg.baseUrl || 'https://api.sambanova.ai/v1';
    if (!this.cfg.apiKey) throw new Error('SAMBA_API_KEY not set');
    const client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL });
    const system = this.systemMsg(messages);
    const chatMsgs = this.chatMsgs(messages);
    const resp = await withTimeout(client.chat.completions.create({
      model: this.cfg.model || 'samba-1',
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs,
      ] as unknown as OpenAI.Chat.ChatCompletionMessage[],
      temperature: 0.7,
    }), DEFAULT_TIMEOUT_MS);
    return resp.choices[0]?.message?.content || '';
  }
}