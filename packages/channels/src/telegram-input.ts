import { Bot, Context } from 'grammy';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { AgentController } from '@nyxmind/core';

export class TelegramInputHandler {
  constructor(private bot: Bot, private controller: AgentController, private allowedIds: string[]) {}

  async start() {
    this.bot.on('message:text', async (ctx) => this.handleText(ctx));
    this.bot.on('message:document', async (ctx) => this.handleDocument(ctx));
    this.bot.on('message:voice', async (ctx) => this.handleVoice(ctx));
    await this.bot.start();
  }

  private isAllowed(ctx: Context) {
    const id = String(ctx.from?.id || '');
    return this.allowedIds.includes(id);
  }

  private async handleText(ctx: Context) {
    if (!this.isAllowed(ctx)) return;
    const userId = String(ctx.from?.id || '');
    const text = ctx.message?.text || '';
    const output = await this.controller.handle(userId, 'telegram', text);
    await ctx.reply(output);
  }

  private async handleDocument(ctx: Context) {
    if (!this.isAllowed(ctx)) return;
    const file = ctx.message?.document;
    if (!file) return;

    const ext = (file.file_name || '').toLowerCase();
    const tmpDir = './tmp';
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, file.file_unique_id + '-' + (file.file_name || 'doc'));

    const tgFile = await ctx.getFile();
    await tgFile.download(filePath);

    let content = '';
    if (ext.endsWith('.pdf')) {
      const data = await fs.readFile(filePath);
      const parsed = await pdfParse(data);
      content = parsed.text;
    } else {
      content = await fs.readFile(filePath, 'utf-8');
    }

    await fs.unlink(filePath).catch(() => {});

    const userId = String(ctx.from?.id || '');
    const output = await this.controller.handle(userId, 'telegram', content);
    await ctx.reply(output);
  }

  private async handleVoice(ctx: Context) {
    if (!this.isAllowed(ctx)) return;
    await ctx.reply('⚠️ Voice input (STT) ainda não implementado.');
  }
}
