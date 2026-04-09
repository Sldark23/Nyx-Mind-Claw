/**
 * ChannelAdapter — unified interface for all communication channels.
 * Each channel (Discord, Telegram, WhatsApp) implements this contract.
 */
export type ChannelName = 'discord' | 'telegram' | 'whatsapp';

export interface Response {
  content: string;
  chatId: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface IncomingMessage {
  senderId: string;
  senderName: string;
  content: string;
  chatId: string;
  timestamp: number;
  raw?: unknown;
}

export interface ChannelAdapter {
  readonly name: ChannelName;

  start(): Promise<void>;
  stop(): Promise<void>;
  send(response: Response): Promise<void>;
  isEnabled(): boolean;
}
