import chalk from 'chalk';
import { ConfigManager } from '@nyxmind/core';

const CONFIG_KEYS: Record<string, string> = {
  LLM_PROVIDER: 'LLM provider (openai, anthropic, etc)',
  LLM_API_KEY: 'API key for the LLM provider',
  LLM_MODEL: 'Model name (e.g. gpt-4o-mini)',
  LLM_MAX_ITERATIONS: 'Max tool-call iterations per message',
  MEMORY_WINDOW_SIZE: 'Number of messages to keep in conversation history',
  DATABASE_URL: 'MongoDB connection string',
  SKILLS_DIR: 'Directory for skill files',
  DATA_DIR: 'Main data directory',
  TMP_DIR: 'Temp directory for temporary files',
  ALLOWED_USER_IDS: 'Comma-separated allowed user IDs (empty = all)',
  MAX_FILE_SIZE: 'Max file size in bytes',
  MAX_AUDIO_SIZE: 'Max audio size in bytes',
  TELEGRAM_BOT_TOKEN: 'Telegram bot token',
  TELEGRAM_ALLOWED_IDS: 'Comma-separated Telegram user IDs',
  DISCORD_TOKEN: 'Discord bot token',
  WHATSAPP_ENABLED: 'Enable WhatsApp (true/false)',
};

export async function configShow(): Promise<void> {
  const cm = new ConfigManager();
  const all = cm.all();

  console.log('\n🔧 NyxMindClaw Config\n');
  for (const [key, desc] of Object.entries(CONFIG_KEYS)) {
    const value = all[key] ?? all[key.toUpperCase()] ?? chalk.dim('<not set>');
    const safe = key.toUpperCase().includes('KEY') || key.toUpperCase().includes('TOKEN');
    console.log(`  ${chalk.bold(key)}`);
    console.log(`  ${chalk.gray('  →')} ${safe && value !== '<not set>' ? chalk.red('••••••••') : value}`);
    console.log(`  ${chalk.gray('  desc:')} ${desc}\n`);
  }
}

export async function configGet(key: string): Promise<void> {
  const cm = new ConfigManager();
  const val = cm.get(key.toUpperCase());
  if (val) {
    const safe = key.toUpperCase().includes('KEY') || key.toUpperCase().includes('TOKEN');
    console.log(safe ? '••••••••' : val);
  }
}

export async function configSet(key: string, value: string): Promise<void> {
  const cm = new ConfigManager();
  cm.set(key.toUpperCase(), value);
  console.log(`${chalk.green('✓')} ${chalk.bold(key)} = ${value}`);
}
