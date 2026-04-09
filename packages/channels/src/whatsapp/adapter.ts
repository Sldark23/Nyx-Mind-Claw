/**
 * WhatsAppAdapter — implements ChannelAdapter for WhatsApp.
 * Uses whatsapp-web.js with LocalAuth for session persistence.
 */
import { Client as WClient, LocalAuth, Message } from 'whatsapp-web.js';
import { AgentController } from '@nyxmind/core';
import { ChannelAdapter, ChannelName, Response } from '../channel-adapter';

export class WhatsAppAdapter implements ChannelAdapter {
  readonly name: ChannelName = 'whatsapp';
  private client: WClient | null = null;

  constructor(private controller: AgentController) {}

  async start(): Promise<void> {
    this.client = new WClient({ authStrategy: new LocalAuth() });

    this.client.on('message', async (msg: Message) => {
      if (msg.fromMe) return;
      const { output, blocked } = await this.controller.handle(
        msg.from,
        'whatsapp',
        msg.body
      );
      if (!blocked) {
        await msg.reply(output);
      }
    });

    this.client.on('disconnected', () => {
      this.client = null;
    });

    await this.client.initialize();
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }

  async send(response: Response): Promise<void> {
    if (!this.client) return;
    const chatId = response.chatId.replace(/\D/g, '') + '@c.us';
    await this.client.sendMessage(chatId, response.content);
  }

  isEnabled(): boolean {
    return process.env.WHATSAPP_ENABLED === 'true';
  }
}
