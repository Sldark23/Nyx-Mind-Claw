#!/usr/bin/env node
import { Command } from 'commander';
import { config as dotenv } from 'dotenv';
import fs from 'fs';
import { AgentController, ProviderConfig } from '@nyxmind/core';
import { TelegramInputHandler, DiscordChannel, WhatsAppChannel } from '@nyxmind/channels';
import { Bot } from 'grammy';

dotenv();

const program = new Command();
program.name('nyxmind').description('NyxMindClaw CLI').version('0.1.0');

program.command('init').description('Create .env template').action(() => {
  const template = `# Providers\nPROVIDER=openai\nOPENAI_API_KEY=\nGROQ_API_KEY=\nGROK_API_KEY=\nMINIMAX_API_KEY=\nANTHROPIC_API_KEY=\nOLLAMA_BASE_URL=http://localhost:11434\nMODEL=gpt-4o-mini\n\n# Channels\nTELEGRAM_BOT_TOKEN=\nTELEGRAM_ALLOWED_IDS=\nDISCORD_TOKEN=\nWHATSAPP_ENABLED=false\n`;
  if (!fs.existsSync('.env')) fs.writeFileSync('.env', template);
  console.log('✅ .env criado');
});

program.command('onboard').description('Interactive onboarding').action(async () => {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('🧩 NyxMindClaw Onboarding');

  const providers = ['openai', 'groq', 'grok', 'minimax', 'anthropic', 'ollama'];
  console.log('\nEscolha o provedor LLM:');
  providers.forEach((p, i) => console.log(`${i + 1}) ${p}`));

  const choice = await rl.question('Número do provedor: ');
  const idx = Math.max(0, Math.min(providers.length - 1, parseInt(choice) - 1));
  const provider = providers[idx];

  let apiKey = '';
  if (provider !== 'ollama') {
    apiKey = await rl.question(`API KEY para ${provider}: `);
  }

  const model = await rl.question('Modelo (ex: gpt-4o-mini, llama3.1, claude-3-5-sonnet) [enter p/ default]: ');
  const maxIterations = await rl.question('MAX_ITERATIONS (default 5): ');
  const memoryWindow = await rl.question('MEMORY_WINDOW_SIZE (default 10): ');
  const skillsDir = await rl.question('SKILLS_DIR (default .agents/skills): ');
  const dataDir = await rl.question('DATA_DIR (default ./data): ');
  const tmpDir = await rl.question('TMP_DIR (default ./tmp): ');

  const whitelist = await rl.question('GLOBAL_ALLOWED_IDS (csv) (enter p/ pular): ');
  const maxFileSize = await rl.question('MAX_FILE_MB (default 20): ');
  const audioLimit = await rl.question('MAX_AUDIO_SEC (default 120): ');
  const skillsEnabled = await rl.question('SKILLS_ENABLED true/false (default true): ');

  const telegram = await rl.question('TELEGRAM_BOT_TOKEN (enter p/ pular): ');
  const allowed = await rl.question('TELEGRAM_ALLOWED_IDS (csv) (enter p/ pular): ');
  const discord = await rl.question('DISCORD_TOKEN (enter p/ pular): ');
  const whatsapp = await rl.question('WHATSAPP_ENABLED true/false (default false): ');

  const lines = [
    `PROVIDER=${provider}`,
    `MODEL=${model || (provider === 'ollama' ? 'llama3.1' : 'gpt-4o-mini')}`,
    `OPENAI_API_KEY=${provider === 'openai' ? apiKey : ''}`,
    `GROQ_API_KEY=${provider === 'groq' ? apiKey : ''}`,
    `GROK_API_KEY=${provider === 'grok' ? apiKey : ''}`,
    `MINIMAX_API_KEY=${provider === 'minimax' ? apiKey : ''}`,
    `ANTHROPIC_API_KEY=${provider === 'anthropic' ? apiKey : ''}`,
    `OLLAMA_BASE_URL=http://localhost:11434`,
    `MAX_ITERATIONS=${maxIterations || '5'}`,
    `MEMORY_WINDOW_SIZE=${memoryWindow || '10'}`,
    `SKILLS_DIR=${skillsDir || '.agents/skills'}`,
    `DATA_DIR=${dataDir || './data'}`,
    `TMP_DIR=${tmpDir || './tmp'}`,
    `GLOBAL_ALLOWED_IDS=${whitelist || ''}`,
    `MAX_FILE_MB=${maxFileSize || '20'}`,
    `MAX_AUDIO_SEC=${audioLimit || '120'}`,
    `SKILLS_ENABLED=${skillsEnabled || 'true'}`,
    `TELEGRAM_BOT_TOKEN=${telegram || ''}`,
    `TELEGRAM_ALLOWED_IDS=${allowed || ''}`,
    `DISCORD_TOKEN=${discord || ''}`,
    `WHATSAPP_ENABLED=${whatsapp || 'false'}`,
  ].join('\n');

  const fs = await import('node:fs');
  fs.writeFileSync('.env', lines);
  console.log('\n✅ .env criado com sucesso');
  rl.close();
});

program.command('run').description('Run NyxMindClaw').action(async () => {
  const provider: ProviderConfig = {
    provider: (process.env.PROVIDER as any) || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.MODEL
  };

  const controller = new AgentController(provider);

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
    const allowed = (process.env.TELEGRAM_ALLOWED_IDS || '').split(',').filter(Boolean);
    const tg = new TelegramInputHandler(bot, controller, allowed);
    await tg.start();
    console.log('✅ Telegram started');
  }

  // Discord
  if (process.env.DISCORD_TOKEN) {
    const discord = new DiscordChannel(process.env.DISCORD_TOKEN, controller);
    await discord.start();
    console.log('✅ Discord started');
  }

  // WhatsApp
  if (process.env.WHATSAPP_ENABLED === 'true') {
    const wa = new WhatsAppChannel(controller);
    await wa.start();
    console.log('✅ WhatsApp started');
  }
});

program.parse(process.argv);
