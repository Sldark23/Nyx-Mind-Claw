/**
 * DiscordAdapter — implements ChannelAdapter for Discord.
 * Wraps the existing DiscordChannel for backward compatibility.
 */
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { AgentController } from '@nyxmind/core';
import { ChannelAdapter, ChannelName, Response } from '../channel-adapter';

export class DiscordAdapter implements ChannelAdapter {
  readonly name: ChannelName = 'discord';
  private client: Client | null = null;

  constructor(
    private token: string,
    private controller: AgentController
  ) {}

  async start(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot || !(msg.channel instanceof TextChannel)) return;
      const { output, blocked } = await this.controller.handle(
        msg.author.id,
        'discord',
        msg.content
      );
      if (!blocked) {
        await msg.reply(output);
      }
    });

    this.client.login(this.token).catch(console.error);
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  async send(response: Response): Promise<void> {
    if (!this.client) return;
    const channel = await this.client.channels.fetch(response.chatId);
    if (channel instanceof TextChannel) {
      await channel.send(response.content);
    }
  }

  isEnabled(): boolean {
    return Boolean(this.token);
  }
}
