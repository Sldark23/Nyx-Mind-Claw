import { Command } from 'commander';
import { TelegramAdapter, DiscordAdapter, WhatsAppAdapter, ChannelAdapter } from '@nyxmind/channels';
import { createControllerFromEnv } from '../../lib/controller';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run NyxMindClaw with all configured channels')
    .action(async () => {
      const controller = createControllerFromEnv();
      const adapters: ChannelAdapter[] = [];

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
        adapters.push(telegram);
        console.log('✅ Telegram adapter started');
      } else {
        console.log('ℹ️  TELEGRAM_BOT_TOKEN not set, skipping Telegram');
      }

      if (process.env.DISCORD_TOKEN) {
        const discord = new DiscordAdapter(process.env.DISCORD_TOKEN, controller);
        await discord.start();
        adapters.push(discord);
        console.log('✅ Discord adapter started');
      } else {
        console.log('ℹ️  DISCORD_TOKEN not set, skipping Discord');
      }

      if (process.env.WHATSAPP_ENABLED === 'true') {
        const whatsapp = new WhatsAppAdapter(controller);
        await whatsapp.start();
        adapters.push(whatsapp);
        console.log('✅ WhatsApp adapter started');
      } else {
        console.log('ℹ️  WHATSAPP_ENABLED != true, skipping WhatsApp');
      }

      console.log('\n🚀 NyxMindClaw running. Press Ctrl+C to stop.\n');

      // Graceful shutdown
      let shuttingDown = false;
      const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

        // 1. Stop accepting new messages (listeners already detached on adapter.stop)
        // 2. Memory checkpoint
        try {
          const memory = controller.getMemory();
          if (memory && 'persist' in memory) {
            await (memory as { persist: () => Promise<void> }).persist();
          }
        } catch (e) {
          console.warn('[shutdown] Memory checkpoint failed:', e);
        }

        // 3. Stop all adapters with timeout
        const stopTimeout = 5000;
        const stopPromises = adapters.map(async (adapter) => {
          try {
            const stopPromise = adapter.stop();
            const timeout = new Promise<void>((resolve) =>
              setTimeout(() => {
                console.warn(`[shutdown] ${adapter.name} stop() timed out after ${stopTimeout}ms`);
                resolve();
              }, stopTimeout)
            );
            await Promise.race([stopPromise, timeout]);
            console.log(`✅ ${adapter.name} adapter stopped`);
          } catch (e) {
            console.warn(`[shutdown] ${adapter.name} stop() error:`, e);
          }
        });

        await Promise.all(stopPromises);
        console.log('\n👋 Shutdown complete. Goodbye!\n');
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    });
}
