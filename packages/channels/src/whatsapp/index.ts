import { Client as WClient, LocalAuth } from 'whatsapp-web.js';
import { AgentController } from '@nyxmind/core';

export class WhatsAppChannel {
  private client: WClient;

  constructor(private controller: AgentController) {
    this.client = new WClient({ authStrategy: new LocalAuth() });
  }

  start() {
    this.client.on('message', async (msg) => {
      if (msg.fromMe) return;
      const { output, blocked } = await this.controller.handle(msg.from, 'whatsapp', msg.body);
      if (!blocked) {
        await msg.reply(output);
      }
    });
    this.client.initialize().catch(console.error);
  }
}
