import fs from 'fs/promises';
import path from 'path';
import { Context } from 'grammy';

export class TelegramOutputHandler {
  async sendText(ctx: Context, text: string) {
    const chunks = this.chunk(text, 3900);
    for (const part of chunks) {
      await ctx.reply(part);
    }
  }

  async sendMarkdownFile(ctx: Context, content: string, filename = 'output.md') {
    const tmpDir = './tmp';
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    await ctx.replyWithDocument({ source: filePath });
    await fs.unlink(filePath).catch(() => {});
  }

  private chunk(text: string, size: number) {
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
    return parts;
  }
}
