/**
 * Config types for nyxmind config commands.
 */

export interface NyxMindConfig {
  // LLM
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmMaxIterations: number;
  // Memory
  memoryWindowSize: number;
  databaseUrl: string;
  // Skills & dirs
  skillsDir: string;
  dataDir: string;
  tmpDir: string;
  // Rate limits
  globalAllowedIds: string[];
  maxFileSize: number;
  maxAudioSize: number;
  // Channels
  telegramBotToken?: string;
  telegramAllowedIds: string[];
  discordToken?: string;
  whatsAppEnabled: boolean;
}

export interface ConfigSource {
  type: 'env' | 'file' | 'default';
  key: string;
  value: string;
}
