#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline/promises';
import { AgentController, ProviderConfig } from '@nyxmind/core';
import { TelegramInputHandler, DiscordChannel, WhatsAppChannel } from '@nyxmind/channels';
import { Bot } from 'grammy';

const program = new Command();
program.name('nyxmind').description('NyxMindClaw CLI').version('0.1.0');

// ─── init ───────────────────────────────────────────────────────────────────
program.command('init').description('Create .env template').action(() => {
  const template = `# LLM Provider
LLM_PROVIDER=openai
LLM_API_KEY=your_api_key_here
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=

# Agent
MAX_ITERATIONS=5
MEMORY_WINDOW_SIZE=20

# Directories
SKILLS_DIR=.agents/skills
DATA_DIR=./data
TMP_DIR=./tmp

# Security
GLOBAL_ALLOWED_IDS=

# Channels
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_IDS=
DISCORD_TOKEN=
WHATSAPP_ENABLED=false
`;
  if (!fs.existsSync('.env')) {
    fs.writeFileSync('.env', template);
    console.log('✅ .env created');
  } else {
    console.log('⚠️  .env already exists');
  }
});

// ─── onboard ────────────────────────────────────────────────────────────────
program.command('onboard').description('Interactive onboarding').action(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🧩 NyxMindClaw Onboarding\n');

  const providers = ['openai', 'groq', 'grok', 'minimax', 'anthropic', 'ollama', 'gemini', 'deepseek'];
  console.log('Choose LLM provider:');
  providers.forEach((p, i) => console.log(`  ${i + 1}) ${p}`));
  const choice = await rl.question('\nProvider number: ');
  const idx = Math.max(0, Math.min(providers.length - 1, parseInt(choice) - 1 || 0));
  const prov = providers[idx];

  let apiKey = '';
  if (prov !== 'ollama') {
    apiKey = await rl.question(`API Key for ${prov}: `);
  }

  const model = await rl.question(`Model [enter for default]: `);
  const maxIter = await rl.question('MAX_ITERATIONS [5]: ') || '5';
  const memWin = await rl.question('MEMORY_WINDOW_SIZE [20]: ') || '20';
  const skillsDir = await rl.question('SKILLS_DIR [.agents/skills]: ') || '.agents/skills';
  const dataDir = await rl.question('DATA_DIR [./data]: ') || './data';
  const tmpDir = await rl.question('TMP_DIR [./tmp]: ') || './tmp';
  const whitelist = await rl.question('GLOBAL_ALLOWED_IDS (csv, enter to skip): ');
  const tgToken = await rl.question('TELEGRAM_BOT_TOKEN (enter to skip): ');
  const tgIds = await rl.question('TELEGRAM_ALLOWED_IDS (csv, enter to skip): ');
  const discord = await rl.question('DISCORD_TOKEN (enter to skip): ');
  const waEnabled = await rl.question('WHATSAPP_ENABLED [false]: ') || 'false';

  const envLines = [
    `LLM_PROVIDER=${prov}`,
    `LLM_API_KEY=${apiKey}`,
    `LLM_MODEL=${model || ''}`,
    `LLM_BASE_URL=`,
    `MAX_ITERATIONS=${maxIter}`,
    `MEMORY_WINDOW_SIZE=${memWin}`,
    `SKILLS_DIR=${skillsDir}`,
    `DATA_DIR=${dataDir}`,
    `TMP_DIR=${tmpDir}`,
    `GLOBAL_ALLOWED_IDS=${whitelist}`,
    `TELEGRAM_BOT_TOKEN=${tgToken}`,
    `TELEGRAM_ALLOWED_IDS=${tgIds}`,
    `DISCORD_TOKEN=${discord}`,
    `WHATSAPP_ENABLED=${waEnabled}`,
  ].join('\n');

  fs.writeFileSync('.env', envLines);
  console.log('\n✅ .env created successfully');
  rl.close();
});

// ─── run ─────────────────────────────────────────────────────────────────────
program.command('run').description('Run NyxMindClaw with channels').action(async () => {
  const cfg: ProviderConfig = {
    provider: (process.env.LLM_PROVIDER as any) || 'openai',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  };

  const controller = new AgentController(cfg);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
    const allowed = (process.env.TELEGRAM_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const tg = new TelegramInputHandler(bot, controller, allowed);
    await tg.start();
    console.log('✅ Telegram handler started');
  } else {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN not set, skipping Telegram');
  }

  if (process.env.DISCORD_TOKEN) {
    const discord = new DiscordChannel(process.env.DISCORD_TOKEN, controller);
    discord.start();
    console.log('✅ Discord handler started');
  }

  if (process.env.WHATSAPP_ENABLED === 'true') {
    const wa = new WhatsAppChannel(controller);
    wa.start();
    console.log('✅ WhatsApp handler started');
  }

  console.log('\n🚀 NyxMindClaw running. Press Ctrl+C to stop.\n');
});

// ─── repl ─────────────────────────────────────────────────────────────────────
program.command('repl').description('Interactive REPL — chat with the agent locally').action(async () => {
  const cfg: ProviderConfig = {
    provider: (process.env.LLM_PROVIDER as any) || 'openai',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  };

  const controller = new AgentController(cfg);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('🧩 NyxMindClaw REPL\nDigite sua mensagem ou :exit para sair\n');

  while (true) {
    const input = await rl.question('\n👤 > ');
    if (!input.trim() || input === ':exit' || input === ':quit') {
      console.log('Tchau!');
      break;
    }
    if (input.startsWith(':')) {
      console.log('Comandos disponíveis: :exit, :quit');
      continue;
    }

    process.stdout.write('\n🤖 ');
    const { output } = await controller.handle('local-user', 'cli', input);
    console.log(output);
  }

  rl.close();
});

program.parse(process.argv);
