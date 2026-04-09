import { Command } from 'commander';
import { DiscordChannel, TelegramInputHandler, WhatsAppChannel } from '@nyxmind/channels';
import { createControllerFromEnv } from '../../lib/controller';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run NyxMindClaw with channels')
    .action(async () => {
      const controller = createControllerFromEnv();

      if (process.env.TELEGRAM_BOT_TOKEN) {
        const allowedIds = (process.env.TELEGRAM_ALLOWED_IDS || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

        const telegram = new TelegramInputHandler(
          process.env.TELEGRAM_BOT_TOKEN,
          controller,
          allowedIds
        );
        await telegram.start();
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
        const whatsapp = new WhatsAppChannel(controller);
        whatsapp.start();
        console.log('✅ WhatsApp handler started');
      }

      console.log('\n🚀 NyxMindClaw running. Press Ctrl+C to stop.\n');
    });
}
