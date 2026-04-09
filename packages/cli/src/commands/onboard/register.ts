import * as fs from 'fs';
import * as readline from 'readline/promises';
import { Command } from 'commander';
import { ProviderConfig } from '@nyxmind/core';
import { testLlmConnection } from '../../lib/llm-test';
import { PROVIDERS } from './constants';
import { buildOnboardEnvFile } from './env';

export function registerOnboardCommand(program: Command): void {
  program
    .command('onboard')
    .description('Interactive onboarding')
    .action(async () => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      try {
        console.log('\n🧩 NyxMindClaw Onboarding\n');
        console.log('Choose LLM provider:');
        PROVIDERS.forEach((provider, index) => console.log(`  ${index + 1}) ${provider}`));

        const choice = await rl.question('\nProvider number: ');
        const index = Math.max(0, Math.min(PROVIDERS.length - 1, (parseInt(choice, 10) || 1) - 1));
        const provider = PROVIDERS[index];

        let apiKey = '';
        if (provider !== 'ollama') {
          apiKey = await rl.question(`API Key for ${provider}: `);
        }

        const model = await rl.question('Model [enter for default]: ');
        const baseUrl = await rl.question(`Base URL [empty for ${provider} default]: `);
        const maxIterations = (await rl.question('MAX_ITERATIONS [5]: ')) || '5';
        const memoryWindow = (await rl.question('MEMORY_WINDOW_SIZE [20]: ')) || '20';
        const skillsDir = (await rl.question('SKILLS_DIR [.agents/skills]: ')) || '.agents/skills';
        const dataDir = (await rl.question('DATA_DIR [./data]: ')) || './data';
        const tmpDir = (await rl.question('TMP_DIR [./tmp]: ')) || './tmp';
        const whitelist = await rl.question('GLOBAL_ALLOWED_IDS (csv, enter to skip): ');
        const telegramBotToken = await rl.question('TELEGRAM_BOT_TOKEN (enter to skip): ');
        const telegramAllowedIds = await rl.question('TELEGRAM_ALLOWED_IDS (csv, enter to skip): ');
        const discordToken = await rl.question('DISCORD_TOKEN (enter to skip): ');
        const whatsappEnabled = (await rl.question('WHATSAPP_ENABLED [false]: ')) || 'false';

        process.stdout.write('\n🔌 Testing LLM connection...\n');

        const testConfig: ProviderConfig = {
          provider,
          apiKey,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
        };

        const { ok, error } = await testLlmConnection(testConfig);
        if (ok) {
          console.log('✅ LLM connection OK');
        } else {
          console.log(`⚠️  LLM connection failed: ${error}`);
          const shouldContinue = await rl.question('Continue anyway? [y/N]: ');
          if (!shouldContinue.trim().toLowerCase().startsWith('y')) {
            console.log('Aborted.');
            return;
          }
        }

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
          whitelist,
          telegramBotToken,
          telegramAllowedIds,
          discordToken,
          whatsappEnabled,
        });

        fs.writeFileSync('.env', envLines);
        console.log('\n✅ .env created successfully');
      } finally {
        rl.close();
      }
    });
}
