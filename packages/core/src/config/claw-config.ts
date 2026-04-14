/**
 * nyxmind-claw.json config system with .env fallback.
 * Inspired by openclaw/.openclawrc — no ninoclaw influence.
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

// ── Model & Cost (from openclaw) ────────────────────────────────────────────

export interface ModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface ModelEntry {
  id: string;
  name: string;
  alias?: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: string[];
  cost?: ModelCost;
  reasoning?: boolean;
}

export interface ModelsProviderConfig {
  provider: string;
  api: string;
  apiKey?: string;
  baseUrl?: string;
  models?: ModelEntry[];
}

export interface ModelsConfig {
  providers?: Record<string, ModelsProviderConfig>;
  mode?: 'merge' | 'replace';
}

// ── Agents (from openclaw) ───────────────────────────────────────────────────

export interface AgentsConfig {
  defaults?: {
    model?: { primary?: string };
    workspace?: string;
    models?: Record<string, { alias?: string }>;
  };
}

// ── Gateway (from openclaw) ─────────────────────────────────────────────────

export interface GatewayConfig {
  auth?: { mode?: 'token' | 'none'; token?: string };
  mode?: 'local' | 'lan' | 'public';
  port?: number;
  bind?: 'localhost' | 'lan' | '0.0.0.0';
  tailscale?: { mode?: 'off' | 'auth-key' | 'oauth'; resetOnExit?: boolean };
  controlUi?: { allowInsecureAuth?: boolean };
}

// ── Session (from openclaw) ─────────────────────────────────────────────────

export interface SessionConfig {
  dmScope?: 'per-channel-peer' | 'global' | 'per-guild';
}

// ── Tools (from openclaw) ────────────────────────────────────────────────────

export interface ToolsConfig {
  profile?: 'coding' | 'general' | 'research';
  web?: {
    search?: { provider?: string; enabled?: boolean; openaiCodex?: Record<string, unknown> };
    fetch?: { enabled?: boolean };
  };
}

// ── Hooks (from openclaw) ────────────────────────────────────────────────────

export interface HooksConfig {
  internal?: {
    enabled?: boolean;
    entries?: Record<string, { enabled?: boolean }>;
  };
}

// ── Wizard (from openclaw) ──────────────────────────────────────────────────

export interface WizardConfig {
  lastRunAt?: string;
  lastRunVersion?: string;
  lastRunCommand?: string;
  lastRunMode?: string;
}

// ── Plugins (from openclaw) ──────────────────────────────────────────────────

export interface PluginEntry {
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface PluginsConfig {
  entries?: Record<string, PluginEntry>;
}

// ── Channels (from openclaw) ─────────────────────────────────────────────────

export interface DiscordConfig {
  enabled?: boolean;
  token?: string;
  groupPolicy?: 'allowlist' | 'blocklist' | 'all';
  guilds?: Record<string, unknown>;
}

export interface TelegramConfig {
  enabled?: boolean;
  botToken?: string;
  allowedIds?: string[];
  rateLimit?: number;
}

export interface WhatsAppConfig {
  enabled?: boolean;
}

// ── Telemetry (from openclaw) ───────────────────────────────────────────────

export interface TelemetryConfig {
  enabled?: boolean;
  endpoint?: string;
}

// ── Logging ───────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  level?: LogLevel;
  pretty?: boolean;
}

// ── Approval ───────────────────────────────────────────────────────────────

export interface ApprovalConfig {
  mode: 'auto' | 'manual' | 'confirmation';
  dangerousTools: string[];
  requireApprovalFor: string[];
}

// ── Full config interface ──────────────────────────────────────────────────────

export interface NyxMindClawConfig {
  // Legacy flat fields (still supported)
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
    telegram?: { botToken: string; allowedIds: string[] };
    discord?: { token: string };
    whatsapp?: { enabled: boolean };
  };
  database?: { url: string };

  // Env / Meta
  nodeEnv?: 'development' | 'test' | 'production';
  agentName?: string;
  locale?: string;
  workspace?: string;

  // Openclaw structured sections
  agents?: AgentsConfig;
  models?: ModelsConfig;
  gateway?: GatewayConfig;
  session?: SessionConfig;
  tools?: ToolsConfig;
  hooks?: HooksConfig;
  wizard?: WizardConfig;
  plugins?: PluginsConfig;
  telemetry?: TelemetryConfig;
  logging?: LoggingConfig;
  approval?: ApprovalConfig;
}

export interface ResolvedConfig extends Required<NyxMindClawConfig> {}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ResolvedConfig = {
  llm: { provider: 'openai', apiKey: '', model: undefined, baseUrl: undefined },
  iterations: 5,
  memoryWindow: 20,
  dirs: { data: './data', tmp: './tmp', skills: '.agents/skills' },
  limits: {
    maxFileSizeMb: 20,
    maxAudioSizeMb: 10,
    rateLimitPerMinute: 20,
    allowedUserIds: [],
  },
  channels: {},
  database: { url: '' },
  // Openclaw defaults
  nodeEnv: 'development',
  agentName: 'NyxMindClaw',
  locale: 'en',
  workspace: '.agents/workspace',
  agents: { defaults: { workspace: '.agents/workspace' } },
  models: { providers: {}, mode: 'merge' },
  gateway: { mode: 'local', port: 18789, bind: 'lan', auth: { mode: 'token' } },
  session: { dmScope: 'per-channel-peer' },
  tools: { profile: 'general' },
  hooks: { internal: { enabled: true, entries: {} } },
  wizard: {},
  plugins: { entries: {} },
  telemetry: { enabled: false },
  logging: { level: 'info', pretty: true },
  approval: { mode: 'auto', dangerousTools: [], requireApprovalFor: [] },
};

// ── JSON file loading ──────────────────────────────────────────────────────────

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

function loadEnvConfig(envPath?: string): void {
  const pathsToTry = [
    envPath ? path.join(process.cwd(), envPath) : path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '..', '.env'),
  ];

  for (const p of pathsToTry) {
    if (p && fs.existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
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
      allowedUserIds: process.env.GLOBAL_ALLOWED_IDS
        ? process.env.GLOBAL_ALLOWED_IDS.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    },
    channels: {
      telegram: process.env.TELEGRAM_BOT_TOKEN ? {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        allowedIds: process.env.TELEGRAM_ALLOWED_IDS
          ? process.env.TELEGRAM_ALLOWED_IDS.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      } : undefined,
      discord: process.env.DISCORD_TOKEN ? { token: process.env.DISCORD_TOKEN } : undefined,
      whatsapp: process.env.WHATSAPP_ENABLED ? { enabled: process.env.WHATSAPP_ENABLED === 'true' } : undefined,
    },
    database: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
    // Openclaw fields from env
    nodeEnv: (process.env.NODE_ENV as 'development' | 'test' | 'production') || undefined,
    agentName: process.env.AGENT_NAME || undefined,
    locale: process.env.LOCALE || undefined,
    workspace: process.env.WORKSPACE || undefined,
    gateway: {
      port: process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : undefined,
      bind: (process.env.GATEWAY_BIND as 'localhost' | 'lan' | '0.0.0.0') || undefined,
      mode: (process.env.GATEWAY_MODE as 'local' | 'lan' | 'public') || undefined,
      auth: process.env.GATEWAY_AUTH_TOKEN ? { mode: 'token', token: process.env.GATEWAY_AUTH_TOKEN } : undefined,
    },
    session: {
      dmScope: (process.env.SESSION_DM_SCOPE as 'per-channel-peer' | 'global' | 'per-guild') || undefined,
    },
    tools: {
      profile: (process.env.TOOLS_PROFILE as 'coding' | 'general' | 'research') || undefined,
      web: {
        search: {
          provider: process.env.WEB_SEARCH_PROVIDER || undefined,
          enabled: process.env.WEB_SEARCH_ENABLED !== undefined
            ? process.env.WEB_SEARCH_ENABLED === 'true'
            : undefined,
        },
        fetch: {
          enabled: process.env.WEB_FETCH_ENABLED !== undefined
            ? process.env.WEB_FETCH_ENABLED === 'true'
            : undefined,
        },
      },
    },
    logging: {
      level: (process.env.LOG_LEVEL as LogLevel) || undefined,
      pretty: process.env.LOG_PRETTY !== undefined
        ? process.env.LOG_PRETTY === 'true'
        : undefined,
    },
    telemetry: {
      enabled: process.env.TELEMETRY_ENABLED !== undefined
        ? process.env.TELEMETRY_ENABLED === 'true'
        : undefined,
      endpoint: process.env.TELEMETRY_ENDPOINT || undefined,
    },
  };
}
/**
 * Recursively deep-merges `source` into `target`.
 *
 * Behavior by value type:
 * - **Object**: recursively merged key-by-key (nested objects merge deeply).
 * - **Array**: replaced entirely — the source array overwrites the target array;
 *   there is no concatenation, no index-wise zip, and no deduplication.
 *   This matters for fields like `models.providers[n].models` where you likely
 *   want the JSON file to define the full list rather than append to the env default.
 * - **Primitive** (string, number, boolean, null, undefined): replaced entirely.
 *
 * Priority: source (JSON or env) wins over target (defaults).
 *
 * @param target - The base object to merge into.
 * @param source - The partial object with values to override or add.
 * @returns A new merged object; target is never mutated.
 */
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
        target[key] !== null &&
        !Array.isArray(target[key])
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

// ── Singleton config ─────────────────────────────────────────────────────────

let cachedConfig: ResolvedConfig | null = null;

export function loadConfig(): ResolvedConfig {
  if (cachedConfig) return cachedConfig;

  loadEnvConfig();

  const jsonConfig = loadJsonConfig();
  const envConfig = envToPartialConfig();

  const base = deepMerge(envConfig, jsonConfig ?? {});
  cachedConfig = deepMerge(DEFAULT_CONFIG, base as Partial<ResolvedConfig>);
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

export function getGateway() {
  return loadConfig().gateway;
}

export function getSession() {
  return loadConfig().session;
}

export function getTools() {
  return loadConfig().tools;
}

export function getLogging() {
  return loadConfig().logging;
}

export function getTelemetry() {
  return loadConfig().telemetry;
}

export function resetConfig(): void {
  cachedConfig = null;
}
