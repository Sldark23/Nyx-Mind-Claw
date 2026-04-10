export { ConfigManager } from './manager';
export type { NyxMindConfig, ConfigSource } from './types';
export {
  loadConfig,
  getConfig,
  getLlmConfig,
  getMaxIterations,
  getMemoryWindow,
  getDirs,
  getLimits,
  getChannels,
  getDatabaseUrl,
  resetConfig,
  type NyxMindClawConfig,
  type ResolvedConfig,
  type LlmProvider,
} from './claw-config';
