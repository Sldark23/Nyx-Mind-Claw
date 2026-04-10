import { Command } from 'commander';
import { TelegramAdapter, DiscordAdapter, WhatsAppAdapter, ChannelAdapter } from '@nyxmind/channels';
import { createControllerFromEnv } from '../../lib/controller';
import { getConfig } from '@nyxmind/core';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run NyxMindClaw with all configured channels')
    .action(async () => {
      const controller = createControllerFromEnv();
      const cfg = getConfig();
      const adapters: ChannelAdapter[] = [];

      if (cfg.channels.telegram?.botToken) {
        const telegram = new TelegramAdapter(
          cfg.channels.telegram.botToken,
          controller,
          cfg.channels.telegram.allowedIds
        );
        await telegram.start();
        adapters.push(telegram);
        console.log('✅ Telegram adapter started');
      } else {
        console.log('ℹ️  telegram not configured, skipping Telegram');
      }

      if (cfg.channels.discord?.token) {
        const discord = new DiscordAdapter(cfg.channels.discord.token, controller);
        await discord.start();
        adapters.push(discord);
        console.log('✅ Discord adapter started');
      } else {
        console.log('ℹ️  discord not configured, skipping Discord');
      }

      if (cfg.channels.whatsapp?.enabled) {
        const whatsapp = new WhatsAppAdapter(controller);
        await whatsapp.start();
        adapters.push(whatsapp);
        console.log('✅ WhatsApp adapter started');
      } else {
        console.log('ℹ️  whatsapp not enabled, skipping WhatsApp');
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
