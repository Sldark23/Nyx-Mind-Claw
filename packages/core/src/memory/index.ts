import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MEMORY_WINDOW = parseInt(process.env.MEMORY_WINDOW_SIZE || '20', 10);

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

  getRecent(conversationId: string, limit = MEMORY_WINDOW): Message[] {
    const rows = this.db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?'
    ).all(conversationId, limit) as Message[];
    return rows.reverse();
  }

  private truncate(conversationId: string): void {
    const count = this.db.prepare(
      'SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?'
    ).get(conversationId) as { c: number };

    if (count.c > MEMORY_WINDOW) {
      const toDelete = count.c - MEMORY_WINDOW;
      this.db.prepare(
        'DELETE FROM messages WHERE id IN (SELECT id FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?)'
      ).run(conversationId, toDelete);
    }
  }

  clearConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
  }

  close(): void {
    this.db.close();
  }
}
