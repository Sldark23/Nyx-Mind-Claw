export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type ChannelType = 'discord' | 'telegram' | 'whatsapp' | 'cli' | 'api';

export interface Message {
  id: string;
  channel: ChannelType;
  content: string;
  senderId: string;
  senderName: string;
  chatId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface Response {
  content: string;
  channel: ChannelType;
  chatId: string;
  replyTo?: string;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}
