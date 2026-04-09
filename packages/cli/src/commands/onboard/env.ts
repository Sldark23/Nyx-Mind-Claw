export function maskEnvValue(value: string): string {
  return value ? '***' : '';
}

export function buildOnboardEnvFile(input: {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxIterations: string;
  memoryWindow: string;
  skillsDir: string;
  dataDir: string;
  tmpDir: string;
  whitelist: string;
  telegramBotToken: string;
  telegramAllowedIds: string;
  discordToken: string;
  whatsappEnabled: string;
}): string {
  return [
    `LLM_PROVIDER=${input.provider}`,
    `LLM_API_KEY=${maskEnvValue(input.apiKey)}`,
    `LLM_MODEL=${input.model}`,
    `LLM_BASE_URL=${input.baseUrl}`,
    `MAX_ITERATIONS=${input.maxIterations}`,
    `MEMORY_WINDOW_SIZE=${input.memoryWindow}`,
    `SKILLS_DIR=${input.skillsDir}`,
    `DATA_DIR=${input.dataDir}`,
    `TMP_DIR=${input.tmpDir}`,
    `GLOBAL_ALLOWED_IDS=${input.whitelist}`,
    `TELEGRAM_BOT_TOKEN=${maskEnvValue(input.telegramBotToken)}`,
    `TELEGRAM_ALLOWED_IDS=${input.telegramAllowedIds}`,
    `DISCORD_TOKEN=${maskEnvValue(input.discordToken)}`,
    `WHATSAPP_ENABLED=${input.whatsappEnabled}`,
  ].join('\n');
}
