import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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
        created_at INTEGER
      );
    `);
  }

  getConversation(id: string) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }

  createConversation(id: string, userId: string, channel: string) {
    this.db.prepare('INSERT OR REPLACE INTO conversations (id, user_id, channel, created_at) VALUES (?, ?, ?, ?)')
      .run(id, userId, channel, Date.now());
  }

  addMessage(conversationId: string, role: string, content: string) {
    const clean = content.replace(/\u0000/g, '');
    this.db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)')
      .run(conversationId, role, clean, Date.now());
  }

  getRecent(conversationId: string, limit = 10) {
    return this.db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?')
      .all(conversationId, limit)
      .reverse();
  }
}
