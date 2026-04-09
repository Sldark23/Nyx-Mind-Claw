import { Bot, InputFile } from 'grammy';
import fs from 'fs';

export class TelegramOutputHandler {
  constructor(private bot: Bot) {}

  async sendText(chatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text);
  }

  async sendDocument(chatId: string, filePath: string, caption?: string): Promise<void> {
    await this.bot.api.sendDocument(chatId, new InputFile(fs.createReadStream(filePath)), { caption });
  }

  async sendImage(chatId: string, filePath: string, caption?: string): Promise<void> {
    await this.bot.api.sendPhoto(chatId, new InputFile(fs.createReadStream(filePath)), { caption });
  }
}
