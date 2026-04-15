export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type ChannelType = 'discord' | 'telegram' | 'whatsapp' | 'cli' | 'api';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  output: string;
  error?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
