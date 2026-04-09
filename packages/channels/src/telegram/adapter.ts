/**
 * TelegramAdapter — implements ChannelAdapter for Telegram.
 * Wraps the existing TelegramInputHandler/TelegramOutputHandler pattern.
 */
import { Bot } from 'grammy';
import { AgentController } from '@nyxmind/core';
import { ChannelAdapter, ChannelName, Response } from '../channel-adapter';

export class TelegramAdapter implements ChannelAdapter {
  readonly name: ChannelName = 'telegram';
  private bot: Bot | null = null;
  private allowedIds: string[];

  constructor(
    private botToken: string,
    private controller: AgentController,
    allowedIds: string[] = []
  ) {
    this.allowedIds = allowedIds;
  }

  async start(): Promise<void> {
    this.bot = new Bot(this.botToken);

    this.bot.on('message:text', async (ctx) => {
      if (!this.isAllowed(ctx)) return;
      const userId = String(ctx.from?.id || '');
      const text = ctx.message?.text || '';
      if (!text.trim()) return;

      await ctx.replyWithChatAction('typing');
      const { output, blocked, reason } = await this.controller.handle(userId, 'telegram', text);

      if (blocked) {
        if (reason === 'rate_limited') {
          await ctx.reply('⏳ Calma aí, muitas mensagens! Tenta novamente em breve.');
        }
        return;
      }

      await this.sendResponse(ctx, output);
    });

    await this.bot.start();
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
  }

  async send(response: Response): Promise<void> {
    if (!this.bot) return;
    const chunks = this.splitMessage(response.content);
    for (const chunk of chunks) {
      await this.bot.api.sendMessage(response.chatId, chunk);
    }
  }

  isEnabled(): boolean {
    return Boolean(this.botToken);
  }

  private isAllowed(ctx: { from?: { id?: number | string } }): boolean {
    const id = String(ctx.from?.id || '');
    return this.allowedIds.length === 0 || this.allowedIds.includes(id);
  }

  private async sendResponse(ctx: { reply: (text: string) => Promise<unknown> }, text: string): Promise<void> {
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  }

  private splitMessage(text: string): string[] {
    const MAX_MSG = 4096;
    if (text.length <= MAX_MSG) return [text];
    const chunks: string[] = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if ((current + '\n' + line).length <= MAX_MSG) {
        current += (current ? '\n' : '') + line;
      } else {
        if (current) chunks.push(current);
        current = line;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }
}
