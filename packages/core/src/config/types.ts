/**
 * Config types for nyxmind config commands.
 */

export interface NyxMindConfig {
  // LLM
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  llmMaxIterations: number;
  // Agent
  memoryWindowSize: number;
  locale: string;
  // Directories
  skillsDir: string;
  dataDir: string;
  tmpDir: string;
  // Database
  databaseUrl: string;
  // Security
  globalAllowedIds: string[];
  maxFileSize: number;
  maxAudioSize: number;
  // Channels — Telegram
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramAllowedIds: string[];
  telegramRateLimit: number;
  // Channels — Discord
  discordEnabled: boolean;
  discordToken?: string;
  discordRateLimit: number;
  // Channels — WhatsApp
  whatsAppEnabled: boolean;
  // Telemetry
  telemetryEnabled: boolean;
  telemetryEndpoint?: string;
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ConfigSource {
  type: 'env' | 'file' | 'default';
  key: string;
  value: string;
}
