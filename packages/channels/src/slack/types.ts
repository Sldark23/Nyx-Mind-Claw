export interface SlackConfig {
  token: string;
  signingSecret?: string;
  appToken?: string;
  botToken?: string;
  channelIds?: string[];
}

export interface SlackMessage {
  type: string;
  channel?: string;
  user?: string;
  text: string;
  ts?: string;
  thread_ts?: string;
  files?: Array<{ url_private: string; name: string }>;
}

export interface SlackEvent {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  event_ts: string;
}