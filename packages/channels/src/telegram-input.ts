import { Bot, Context } from 'grammy';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import { AgentController } from '@nyxmind/core';

const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '20', 10);
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export class TelegramInputHandler {
  constructor(
    private bot: Bot,
    private controller: AgentController,
    private allowedIds: string[]
  ) {}

  async start() {
    this.bot.on('message:text', async (ctx) => this.handleText(ctx));
    this.bot.on('message:document', async (ctx) => this.handleDocument(ctx));
    this.bot.on('message:voice', async (ctx) => this.handleVoice(ctx));
    await this.bot.start();
  }

  private isAllowed(ctx: Context): boolean {
    const id = String(ctx.from?.id || '');
    return this.allowedIds.length === 0 || this.allowedIds.includes(id);
  }

  private async handleText(ctx: Context) {
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
  }

  private async handleDocument(ctx: Context) {
    if (!this.isAllowed(ctx)) return;
    const file = ctx.message?.document;
    if (!file) return;

    const ext = (file.file_name || '').toLowerCase();
    const fileSizeMB = (file.file_size || 0) / 1024 / 1024;
    if (fileSizeMB > MAX_FILE_MB) {
      await ctx.reply(`⚠️ Arquivo muito grande (${fileSizeMB.toFixed(1)}MB). Limite: ${MAX_FILE_MB}MB.`);
      return;
    }

    const tmpDir = process.env.TMP_DIR || './tmp';
    await fs.mkdir(tmpDir, { recursive: true });
    const destPath = path.join(tmpDir, `${file.file_unique_id}-${file.file_name || 'doc'}`);

    try {
      const tgFile = await ctx.getFile();
      const filePath = tgFile.file_path;
      if (!filePath) {
        await ctx.reply('⚠️ Não consegui acessar o arquivo.');
        return;
      }

      // Download via Telegram Bot API
      const downloadUrl = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${filePath}`;
      const response = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 60000 });
      await fs.writeFile(destPath, response.data);

      let content = '';
      if (ext.endsWith('.pdf')) {
        const data = await fs.readFile(destPath);
        const parsed = await pdfParse(data);
        content = parsed.text;
      } else {
        content = await fs.readFile(destPath, 'utf-8');
      }

      if (!content.trim()) {
        await ctx.reply('⚠️ Não consegui extrair texto desse arquivo.');
        return;
      }

      const userId = String(ctx.from?.id || '');
      await ctx.replyWithChatAction('typing');
      const { output } = await this.controller.handle(userId, 'telegram', content);
      await this.sendResponse(ctx, output);
    } finally {
      await fs.unlink(destPath).catch(() => {});
    }
  }

  private async handleVoice(_ctx: Context) {
    await _ctx.reply('⚠️ Voice input (STT) ainda não implementado.');
  }

  private async sendResponse(ctx: Context, text: string) {
    const MAX_MSG = 4096;
    if (text.length <= MAX_MSG) {
      await ctx.reply(text);
      return;
    }
    const chunks = text.match(/(.|[\r\n]){1,MAX_MSG}/g) || [];
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  }
}
