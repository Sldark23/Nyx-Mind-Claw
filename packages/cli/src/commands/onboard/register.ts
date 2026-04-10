import * as fs from 'fs';
import * as readline from 'readline/promises';
import { Command } from 'commander';
import { ProviderConfig } from '@nyxmind/core';
import { testLlmConnection } from '../../lib/llm-test';
import { withTelemetry } from '../../lib/telemetry';
import { PROVIDERS } from './constants';
import { buildOnboardEnvFile } from './env';

async function ask(question: string, rl: readline.Interface, fallback: string): Promise<string> {
  const val = await rl.question(`${question} [${fallback}]: `);
  return val.trim() || fallback;
}

async function confirm(question: string, rl: readline.Interface, fallback = false): Promise<boolean> {
  const val = await rl.question(`${question} [${fallback ? 'Y' : 'y/N'}]: `);
  if (!val.trim()) return fallback;
  return val.trim().toLowerCase().startsWith('y');
}

async function choose(question: string, rl: readline.Interface, options: string[], fallback: string): Promise<string> {
  console.log(question);
  options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
  const val = await rl.question(`Choice [${fallback}]: `);
  const idx = parseInt(val.trim(), 10) - 1;
  if (!val.trim()) return fallback;
  return options[Math.max(0, Math.min(options.length - 1, idx))] ?? fallback;
}

export function registerOnboardCommand(program: Command): void {
  program
    .command('onboard')
    .description('Interactive onboarding — configure everything')
    .action(withTelemetry('onboard', async () => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      try {
        console.log('\n🧩 NyxMindClaw Onboarding\n');
        console.log('─'.repeat(50));

        // ── LLM ──────────────────────────────────────────────
        console.log('\n[1/8] LLM Provider\n');
        console.log('Choose provider:');
        PROVIDERS.forEach((p, i) => console.log(`  ${i + 1}) ${p}`));

        const choice = await rl.question('\nProvider number [1]: ');
        const provIdx = Math.max(0, Math.min(PROVIDERS.length - 1, (parseInt(choice, 10) || 1) - 1));
        const provider = PROVIDERS[provIdx];

        let apiKey = '';
        if (provider !== 'ollama') {
          apiKey = await rl.question(`\nAPI Key for ${provider}: `);
        }

        const model = await rl.question('Model (Enter for default): ');
        const baseUrl = await rl.question(`Base URL (Enter for ${provider} default): `);

        process.stdout.write('\n🔌 Testing LLM connection...\n');
        const { ok, error } = await testLlmConnection({
          provider, apiKey, baseUrl: baseUrl || undefined, model: model || undefined,
        } as ProviderConfig);

        if (ok) {
          console.log('✅ LLM connection OK\n');
        } else {
          console.log(`⚠️  LLM connection failed: ${error}`);
          const cont = await confirm('Continue anyway', rl, false);
          if (!cont) { console.log('Aborted.'); return; }
          console.log('');
        }

        // ── Agent identity ──────────────────────────────────────
        console.log('\n[2/8] Agent Identity\n');
        const agentName = await ask('AGENT_NAME', rl, 'NyxMindClaw');
        const nodeEnv = await choose('NODE_ENV', rl,
          ['development', 'test', 'production'], 'development');

        // ── Agent behaviour ──────────────────────────────────────
        console.log('\n[3/8] Agent Behaviour\n');
        const maxIterations = await ask('MAX_ITERATIONS', rl, '10');
        const memoryWindow = await ask('MEMORY_WINDOW_SIZE', rl, '20');
        const locale = await ask('LOCALE (en, pt, es...)', rl, 'en');
        const workspace = await ask('WORKSPACE', rl, '.agents/workspace');

        // ── Directories ───────────────────────────────────────
        console.log('\n[4/8] Directories\n');
        const skillsDir = await ask('SKILLS_DIR', rl, '.agents/skills');
        const dataDir = await ask('DATA_DIR', rl, './data');
        const tmpDir = await ask('TMP_DIR', rl, './tmp');

        // ── Database ──────────────────────────────────────────
        console.log('\n[5/8] Database\n');
        console.log('Storage options:');
        console.log('  1) Local file storage (no DB needed — recommended)');
        console.log('  2) MongoDB (needs Docker or local MongoDB)');
        const dbChoice = await rl.question('Choice [1]: ');
        let dbUrl = '';
        if (dbChoice.trim() !== '2') {
          dbUrl = 'local';
          console.log('✅ Using local file storage');
        } else {
          dbUrl = await ask('DATABASE_URL', rl, 'mongodb://localhost:27017/nyxmind');
          const mongoOk = await confirm('Start MongoDB via Docker if not running', rl, true);
          void mongoOk; // handled at install time
        }

        // ── Security ───────────────────────────────────────────
        console.log('\n[6/8] Security\n');
        const whitelist = await rl.question('GLOBAL_ALLOWED_IDS (csv, Enter to skip): ');
        const maxFileSize = await ask('MAX_FILE_SIZE (bytes)', rl, '10485760');
        const maxAudioSize = await ask('MAX_AUDIO_SIZE (bytes)', rl, '5242880');

        // ── Channels ───────────────────────────────────────────
        console.log('\n[7/8] Channels\n');

        console.log('Discord:');
        const discordEnabled = await confirm('Enable Discord', rl, false);
        let discordToken = '';
        let discordRateLimit = '';
        let discordGroupPolicy = '';
        if (discordEnabled) {
          discordToken = await rl.question('  DISCORD_TOKEN: ');
          discordGroupPolicy = await choose('  DISCORD_GROUP_POLICY', rl,
            ['allowlist', 'blocklist', 'all'], 'allowlist');
          discordRateLimit = await ask('  DISCORD_RATE_LIMIT (req/min)', rl, '60');
        }

        console.log('\nTelegram:');
        const tgEnabled = await confirm('Enable Telegram', rl, false);
        let telegramBotToken = '';
        let telegramAllowedIds = '';
        let telegramRateLimit = '';
        if (tgEnabled) {
          telegramBotToken = await rl.question('  TELEGRAM_BOT_TOKEN: ');
          telegramAllowedIds = await rl.question('  TELEGRAM_ALLOWED_IDS (csv): ');
          telegramRateLimit = await ask('  TELEGRAM_RATE_LIMIT (req/min)', rl, '30');
        }

        console.log('\nWhatsApp:');
        const whatsappEnabled = await confirm('Enable WhatsApp', rl, false);

        // ── Tools, Logging, Telemetry ───────────────────────────
        console.log('\n[8/8] Tools, Logging & Telemetry\n');
        const toolsProfile = await choose('TOOLS_PROFILE', rl,
          ['general', 'coding', 'research'], 'general');
        const webSearchEnabled = await confirm('Enable web search', rl, true);
        let webSearchProvider = '';
        if (webSearchEnabled) {
          webSearchProvider = await ask('  WEB_SEARCH_PROVIDER', rl, 'firecrawl');
        }
        const webFetchEnabled = await confirm('Enable web fetch', rl, true);
        const logLevel = await choose('LOG_LEVEL', rl,
          ['debug', 'info', 'warn', 'error'], 'info');
        const logPretty = await confirm('LOG_PRETTY (pretty-print logs)', rl, true);
        const telemetryEnabled = await confirm('Enable anonymous telemetry', rl, false);
        let telemetryEndpoint = '';
        if (telemetryEnabled) {
          telemetryEndpoint = await rl.question('  TELEMETRY_ENDPOINT: ');
        }

        // ──────────────────────────────────────────────────────
        process.stdout.write('\n');
        console.log('─'.repeat(50));
        console.log('\n📦 Generating .env...\n');

        const envLines = buildOnboardEnvFile({
          provider,
          apiKey,
          model,
          baseUrl,
          maxIterations,
          memoryWindow,
          skillsDir,
          dataDir,
          tmpDir,
          locale,
          whitelist,
          maxFileSize,
          maxAudioSize,
          dbUrl,
          tgEnabled,
          telegramBotToken,
          telegramAllowedIds,
          telegramRateLimit,
          discordEnabled,
          discordToken,
          discordRateLimit,
          discordGroupPolicy,
          whatsappEnabled,
          telemetryEnabled,
          telemetryEndpoint,
          logLevel,
          logPretty,
          agentName,
          nodeEnv,
          workspace,
          toolsProfile,
          webSearchEnabled,
          webSearchProvider,
          webFetchEnabled,
        });

        fs.writeFileSync('.env', envLines);

        console.log('✅ .env created successfully\n');
        console.log('─'.repeat(50));
        console.log('\nNext steps:');
        console.log('  1. Run: npm run build');
        console.log('  2. Run: nyxmind doctor   (verify setup)');
        console.log('  3. Run: nyxmind onboard (reconfigure anytime)');
        console.log('');
      } finally {
        rl.close();
      }
    }));
}
