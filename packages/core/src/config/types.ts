/**
 * NyxMindClaw config types.
 * Inspired by openclaw/.openclawrc — no ninoclaw influence.
 */

// ── Meta ───────────────────────────────────────────────────────────────────

export interface MetaConfig {
  lastTouchedVersion?: string;
  lastTouchedAt?: string;
}

// ── Models ───────────────────────────────────────────────────────────────────

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

// ── Agents ──────────────────────────────────────────────────────────────────

export interface AgentDefaultModel {
  primary?: string;
}

export interface AgentDefaults {
  model?: AgentDefaultModel;
  workspace?: string;
  models?: Record<string, { alias?: string }>;
}

export interface AgentsConfig {
  defaults?: AgentDefaults;
}

// ── Gateway ─────────────────────────────────────────────────────────────────

export interface GatewayAuth {
  mode?: 'token' | 'none';
  token?: string;
}

export interface GatewayTailscale {
  mode?: 'off' | 'auth-key' | 'oauth';
  resetOnExit?: boolean;
}

export interface GatewayControlUi {
  allowInsecureAuth?: boolean;
}

export interface GatewayConfig {
  auth?: GatewayAuth;
  mode?: 'local' | 'lan' | 'public';
  port?: number;
  bind?: 'localhost' | 'lan' | '0.0.0.0';
  tailscale?: GatewayTailscale;
  controlUi?: GatewayControlUi;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface SessionConfig {
  dmScope?: 'per-channel-peer' | 'global' | 'per-guild';
}

// ── Tools ────────────────────────────────────────────────────────────────────

export interface ToolsWebSearch {
  provider?: string;
  enabled?: boolean;
  openaiCodex?: Record<string, unknown>;
}

export interface ToolsWebFetch {
  enabled?: boolean;
}

export interface ToolsWeb {
  search?: ToolsWebSearch;
  fetch?: ToolsWebFetch;
}

export interface ToolsConfig {
  profile?: 'coding' | 'general' | 'research';
  web?: ToolsWeb;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export interface HookEntry {
  enabled?: boolean;
}

export interface HooksInternalEntries {
  'boot-md'?: HookEntry;
  'bootstrap-extra-files'?: HookEntry;
  'command-logger'?: HookEntry;
  'session-memory'?: HookEntry;
}

export interface HooksInternal {
  enabled?: boolean;
  entries?: HooksInternalEntries;
}

export interface HooksConfig {
  internal?: HooksInternal;
}

// ── Wizard ──────────────────────────────────────────────────────────────────

export interface WizardConfig {
  lastRunAt?: string;
  lastRunVersion?: string;
  lastRunCommand?: string;
  lastRunMode?: string;
}

// ── Plugins ────────────────────────────────────────────────────────────────────

export interface PluginEntry {
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface PluginsConfig {
  entries?: Record<string, PluginEntry>;
}

// ── Channels ────────────────────────────────────────────────────────────────

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

export interface ChannelsConfig {
  discord?: DiscordConfig;
  telegram?: TelegramConfig;
  whatsapp?: WhatsAppConfig;
}

// ── Telemetry ────────────────────────────────────────────────────────────────

export interface TelemetryConfig {
  enabled?: boolean;
  endpoint?: string;
}

// ── Logging ─────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  level?: LogLevel;
  pretty?: boolean;
}

// ── Approval ─────────────────────────────────────────────────────────────────

export interface ApprovalConfig {
  mode: 'auto' | 'manual' | 'confirmation';
  dangerousTools: string[];
  requireApprovalFor: string[];
}

// ── Main nyxmind-claw.json root ─────────────────────────────────────────────

export interface NyxMindClawJsonConfig {
  meta?: MetaConfig;
  agents?: AgentsConfig;
  models?: ModelsConfig;
  gateway?: GatewayConfig;
  session?: SessionConfig;
  tools?: ToolsConfig;
  hooks?: HooksConfig;
  wizard?: WizardConfig;
  plugins?: PluginsConfig;
  channels?: ChannelsConfig;
  telemetry?: TelemetryConfig;
  logging?: LoggingConfig;
  approval?: ApprovalConfig;

  // Legacy flat fields (still supported for backward compat)
  nodeEnv?: 'development' | 'test' | 'production';
  agentName?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  llmMaxTokens?: number;
  llmTimeout?: number;
  llmMaxIterations?: number;
  memoryWindowSize?: number;
  locale?: string;
  workspace?: string;
  skillsDir?: string;
  dataDir?: string;
  tmpDir?: string;
  databaseUrl?: string;
  globalAllowedIds?: string[];
  maxFileSize?: number;
  maxAudioSize?: number;
  logLevel?: LogLevel;
  logPretty?: boolean;
}
