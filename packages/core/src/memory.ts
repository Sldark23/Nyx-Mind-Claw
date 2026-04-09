import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MEMORY_WINDOW = parseInt(process.env.MEMORY_WINDOW_SIZE || '20', 10);

export class MemoryManager {
  private db: Database.Database;

  constructor(dbPath = './data/nyxmind.db') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
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

  getConversation(id: string) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }

  createConversation(id: string, userId: string, channel: string) {
    this.db.prepare(
      'INSERT OR REPLACE INTO conversations (id, user_id, channel, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, userId, channel, Date.now());
  }

  addMessage(conversationId: string, role: string, content: string) {
    const clean = (content || '').replace(/\u0000/g, '').trim();
    if (!clean) return;
    this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(conversationId, role, clean, Date.now());
    this.truncate(conversationId);
  }

  getRecent(conversationId: string, limit = MEMORY_WINDOW) {
    const rows = this.db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?'
    ).all(conversationId, limit) as Array<{ role: string; content: string }>;
    return rows.reverse();
  }

  private truncate(conversationId: string) {
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

  clearConversation(conversationId: string) {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
  }

  close() {
    this.db.close();
  }
}
