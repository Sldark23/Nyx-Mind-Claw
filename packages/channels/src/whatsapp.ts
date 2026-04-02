import { Client as WClient, LocalAuth } from 'whatsapp-web.js';
import { AgentController } from '@nyxmind/core';

export class WhatsAppChannel {
  private client: WClient;

  constructor(private controller: AgentController) {
    this.client = new WClient({ authStrategy: new LocalAuth() });
  }

  async start() {
    this.client.on('message', async (msg) => {
      const output = await this.controller.handle(msg.from, 'whatsapp', msg.body);
      await msg.reply(output);
    });
    await this.client.initialize();
  }
}
