import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config';
import type { BootstrapAnswers } from '../agent/bootstrap';

export interface Conversation {
  id: string;
  user_id: string;
  channel: string;
  created_at: number;
}

export interface Message {
  role: string;
  content: string;
}

export interface BootstrapProfile {
  version: number;
  completedAt?: string;
  answers: BootstrapAnswers;
}

const BOOTSTRAP_VERSION = 1;

export class MemoryManager {
  private db: Database.Database;

  constructor(private dbPath = './data/nyxmind.db') {
    const dir = path.dirname(dbPath);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        channel TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        created_at INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
      CREATE TABLE IF NOT EXISTS agent_profile (
        user_id TEXT PRIMARY KEY,
        version INTEGER,
        completed_at TEXT,
        agent_name TEXT,
        agent_vibe TEXT,
        agent_timezone TEXT,
        user_name TEXT,
        user_role TEXT,
        user_timezone TEXT,
        user_vibe TEXT
      );
    `);
  }

  getConversation(id: string): Conversation | undefined {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
  }

  createConversation(id: string, userId: string, channel: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO conversations (id, user_id, channel, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, userId, channel, Date.now());
  }

  addMessage(conversationId: string, role: string, content: string): void {
    const clean = (content || '').replace(/\u0000/g, '').trim();
    if (!clean) return;
    this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(conversationId, role, clean, Date.now());
    this.truncate(conversationId);
  }

  getRecent(conversationId: string, limit?: number): Message[] {
    const memoryWindow = limit ?? getConfig().memoryWindow;
    const rows = this.db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?'
    ).all(conversationId, memoryWindow) as Message[];
    return rows.reverse();
  }

  private truncate(conversationId: string): void {
    const count = this.db.prepare(
      'SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?'
    ).get(conversationId) as { c: number };

    const memoryWindow = getConfig().memoryWindow;
    if (count.c > memoryWindow) {
      const toDelete = count.c - memoryWindow;
      this.db.prepare(
        'DELETE FROM messages WHERE id IN (SELECT id FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?)'
      ).run(conversationId, toDelete);
    }
  }

  clearConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
  }

  // ── Bootstrap profile ──────────────────────────────────────────────────────

  getBootstrapProfile(userId: string): BootstrapProfile | null {
    const row = this.db.prepare('SELECT * FROM agent_profile WHERE user_id = ?').get(userId) as {
      user_id: string; version: number; completed_at: string | null;
      agent_name: string | null; agent_vibe: string | null; agent_timezone: string | null;
      user_name: string | null; user_role: string | null; user_timezone: string | null; user_vibe: string | null;
    } | undefined;
    if (!row) return null;
    return {
      version: row.version,
      completedAt: row.completed_at ?? undefined,
      answers: {
        agentName: row.agent_name ?? undefined,
        agentVibe: row.agent_vibe ?? undefined,
        agentTimezone: row.agent_timezone ?? undefined,
        userName: row.user_name ?? undefined,
        userRole: row.user_role ?? undefined,
        userTimezone: row.user_timezone ?? undefined,
        userVibe: row.user_vibe ?? undefined,
      },
    };
  }

  saveBootstrapAnswer(userId: string, key: keyof BootstrapAnswers, value: string): void {
    const colMap: Record<keyof BootstrapAnswers, string> = {
      agentName: 'agent_name',
      agentVibe: 'agent_vibe',
      agentTimezone: 'agent_timezone',
      userName: 'user_name',
      userRole: 'user_role',
      userTimezone: 'user_timezone',
      userVibe: 'user_vibe',
    };
    const col = colMap[key];
    if (!col) return;
    // Upsert using replace
    this.db.prepare(`INSERT OR REPLACE INTO agent_profile (user_id, version, ${col}) VALUES (?, ?, ?)`)
      .run(userId, BOOTSTRAP_VERSION, value);
  }

  completeBootstrap(userId: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO agent_profile (user_id, version, completed_at) VALUES (?, ?, ?)'
    ).run(userId, BOOTSTRAP_VERSION, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}

export { VectorStore } from './vector-store';
