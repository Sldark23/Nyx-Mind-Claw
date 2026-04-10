/**
 * nyxmind-claw.json config system with .env fallback.
 *
 * Loads nyxmind-claw.json if it exists in the project root,
 * otherwise falls back to environment variables (.env).
 *
 * Priority: nyxmind-claw.json > environment variables
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// ── Types ────────────────────────────────────────────────────────────────────

export type LlmProvider = 'openai' | 'groq' | 'grok' | 'minimax' | 'anthropic' | 'ollama' | 'gemini' | 'deepseek';

export interface NyxMindClawConfig {
  llm: {
    provider: LlmProvider;
    apiKey: string;
    model?: string;
    baseUrl?: string;
  };
  iterations: number;
  memoryWindow: number;
  dirs: {
    data: string;
    tmp: string;
    skills: string;
  };
  limits: {
    maxFileSizeMb: number;
    maxAudioSizeMb: number;
    rateLimitPerMinute: number;
    allowedUserIds: string[];
  };
  channels: {
    telegram?: {
      botToken: string;
      allowedIds: string[];
    };
    discord?: {
      token: string;
    };
    whatsapp?: {
      enabled: boolean;
    };
  };
  database?: {
    url: string;
  };
}

export interface ResolvedConfig extends Required<NyxMindClawConfig> {}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ResolvedConfig = {
  llm: {
    provider: 'openai',
    apiKey: '',
    model: undefined,
    baseUrl: undefined,
  },
  iterations: 5,
  memoryWindow: 20,
  dirs: {
    data: './data',
    tmp: './tmp',
    skills: '.agents/skills',
  },
  limits: {
    maxFileSizeMb: 20,
    maxAudioSizeMb: 10,
    rateLimitPerMinute: 20,
    allowedUserIds: [],
  },
  channels: {},
  database: { url: '' },
};

// ── JSON file loading ────────────────────────────────────────────────────────

function findConfigPath(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'nyxmind-claw.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const moduleDir = __dirname;
  const moduleCandidate = path.join(moduleDir, '..', '..', '..', '..', 'nyxmind-claw.json');
  if (fs.existsSync(moduleCandidate)) return moduleCandidate;
  return null;
}

function loadJsonConfig(): Partial<NyxMindClawConfig> | null {
  const configPath = findConfigPath();
  if (!configPath) return null;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as Partial<NyxMindClawConfig>;
  } catch {
    return null;
  }
}

// ── .env loading ─────────────────────────────────────────────────────────────

function loadEnvConfig(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
  }
  const rootEnv = path.join(process.cwd(), '..', '..', '.env');
  if (fs.existsSync(rootEnv)) {
    dotenv.parse(fs.readFileSync(rootEnv, 'utf-8'));
  }
  try {
    require('dotenv/config');
  } catch {
    // dotenv not available in some contexts
  }
}

// ── Env → partial config mapping ─────────────────────────────────────────────

function envToPartialConfig(): Partial<NyxMindClawConfig> {
  const llmProvider = process.env.LLM_PROVIDER as LlmProvider | undefined;
  if (!llmProvider) return {};

  return {
    llm: {
      provider: llmProvider,
      apiKey: process.env.LLM_API_KEY || '',
      model: process.env.LLM_MODEL || undefined,
      baseUrl: process.env.LLM_BASE_URL || undefined,
    },
    iterations: process.env.MAX_ITERATIONS ? parseInt(process.env.MAX_ITERATIONS, 10) : undefined,
    memoryWindow: process.env.MEMORY_WINDOW_SIZE ? parseInt(process.env.MEMORY_WINDOW_SIZE, 10) : undefined,
    dirs: {
      data: process.env.DATA_DIR ?? './data',
      tmp: process.env.TMP_DIR ?? './tmp',
      skills: process.env.SKILLS_DIR ?? '.agents/skills',
    },
    limits: {
      maxFileSizeMb: process.env.MAX_FILE_MB ? parseInt(process.env.MAX_FILE_MB, 10) : 20,
      maxAudioSizeMb: process.env.MAX_AUDIO_MB ? parseInt(process.env.MAX_AUDIO_MB, 10) : 10,
      rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10) : 20,
      allowedUserIds: process.env.ALLOWED_USER_IDS
        ? process.env.ALLOWED_USER_IDS.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    },
    channels: {
      telegram: process.env.TELEGRAM_BOT_TOKEN ? {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        allowedIds: process.env.TELEGRAM_ALLOWED_IDS
          ? process.env.TELEGRAM_ALLOWED_IDS.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      } : undefined,
      discord: process.env.DISCORD_TOKEN ? {
        token: process.env.DISCORD_TOKEN,
      } : undefined,
      whatsapp: process.env.WHATSAPP_ENABLED ? {
        enabled: process.env.WHATSAPP_ENABLED === 'true',
      } : undefined,
    },
    database: (process.env.MONGODB_URI || process.env.MONGO_URI) ? {
      url: process.env.MONGODB_URI || process.env.MONGO_URI || '',
    } : undefined,
  };
}

// ── Deep merge ────────────────────────────────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key];
    if (sv !== undefined) {
      if (
        sv !== null &&
        typeof sv === 'object' &&
        !Array.isArray(sv) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        (result as Record<string, unknown>)[key as string] = deepMerge(
          target[key] as Record<string, unknown>,
          sv as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key as string] = sv;
      }
    }
  }
  return result;
}

// ── Singleton config ──────────────────────────────────────────────────────────

let cachedConfig: ResolvedConfig | null = null;

export function loadConfig(): ResolvedConfig {
  if (cachedConfig) return cachedConfig;

  loadEnvConfig();

  const jsonConfig = loadJsonConfig();
  const envConfig = envToPartialConfig();

  const merged = jsonConfig
    ? deepMerge(deepMerge(envConfig, jsonConfig), {})
    : envConfig;

  cachedConfig = deepMerge(DEFAULT_CONFIG, merged as Partial<ResolvedConfig>);
  return cachedConfig;
}

export function getConfig(): ResolvedConfig {
  return loadConfig();
}

export function getLlmConfig() {
  return loadConfig().llm;
}

export function getMaxIterations(): number {
  return loadConfig().iterations;
}

export function getMemoryWindow(): number {
  return loadConfig().memoryWindow;
}

export function getDirs() {
  return loadConfig().dirs;
}

export function getLimits() {
  return loadConfig().limits;
}

export function getChannels() {
  return loadConfig().channels;
}

export function getDatabaseUrl(): string | undefined {
  return loadConfig().database?.url;
}

export function resetConfig(): void {
  cachedConfig = null;
}
