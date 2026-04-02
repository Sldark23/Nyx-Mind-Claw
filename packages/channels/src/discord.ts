import { Client, GatewayIntentBits } from 'discord.js';
import { AgentController } from '@nyxmind/core';

export class DiscordChannel {
  private client: Client;

  constructor(private token: string, private controller: AgentController) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  }

  async start() {
    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot) return;
      const output = await this.controller.handle(msg.author.id, 'discord', msg.content);
      await msg.reply(output);
    });
    await this.client.login(this.token);
  }
}
