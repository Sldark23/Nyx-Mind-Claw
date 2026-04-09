import { Command } from 'commander';
import { TelegramAdapter, DiscordAdapter, WhatsAppAdapter } from '@nyxmind/channels';
import { createControllerFromEnv } from '../../lib/controller';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run NyxMindClaw with all configured channels')
    .action(async () => {
      const controller = createControllerFromEnv();

      if (process.env.TELEGRAM_BOT_TOKEN) {
        const allowedIds = (process.env.TELEGRAM_ALLOWED_IDS || '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

        const telegram = new TelegramAdapter(
          process.env.TELEGRAM_BOT_TOKEN,
          controller,
          allowedIds
        );
        await telegram.start();
        console.log('✅ Telegram adapter started');
      } else {
        console.log('ℹ️  TELEGRAM_BOT_TOKEN not set, skipping Telegram');
      }

      if (process.env.DISCORD_TOKEN) {
        const discord = new DiscordAdapter(process.env.DISCORD_TOKEN, controller);
        await discord.start();
        console.log('✅ Discord adapter started');
      } else {
        console.log('ℹ️  DISCORD_TOKEN not set, skipping Discord');
      }

      if (process.env.WHATSAPP_ENABLED === 'true') {
        const whatsapp = new WhatsAppAdapter(controller);
        await whatsapp.start();
        console.log('✅ WhatsApp adapter started');
      } else {
        console.log('ℹ️  WHATSAPP_ENABLED != true, skipping WhatsApp');
      }

      console.log('\n🚀 NyxMindClaw running. Press Ctrl+C to stop.\n');
    });
}
