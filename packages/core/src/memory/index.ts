import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config';
import type { BootstrapAnswers } from '../agent/bootstrap';
import { GraphMemory, type Entity, type MemoryResult, type InteractionRecord, extractEntities } from './graph-memory';

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
  private graph: GraphMemory;

  constructor(private dbPath = './data/nyxmind.db') {
    const dir = path.dirname(dbPath);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.graph = new GraphMemory(dbPath.replace('.db', '-graph.db'), this.db);
      this.init();
    } catch (err) {
      console.warn(`[MemoryManager] Failed to initialize database: ${err}. Memory features disabled.`);
      this.db = { // Create a dummy database interface
        exec: () => [],
        prepare: () => ({ run: () => {}, get: () => undefined, all: () => [] }),
        close: () => {}
      } as unknown as Database.Database;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.graph = {
        close: () => {},
        getOrCreateEntity: () => ({ id: 'fallback', name: '', type: 'unknown' as const, properties: {}, firstSeen: 0, lastSeen: 0 }),
        getEntityByName: () => undefined,
        getRelatedEntities: () => [],
        search: () => [],
        addEpisodic: () => {},
        upsertRelationship: () => {},
        buildContext: () => '',
        consolidate: () => ({ merged: 0, deleted: 0 })
      } as unknown as GraphMemory;
    }
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
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
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

  // ── Graph memory (entity extraction + episodic/semantic) ─────────────────────

  getGraph(): GraphMemory {
    return this.graph;
  }

  /** Extract entities from content and store in graph memory. */
  extractEntities(conversationId: string, content: string): Entity[] {
    const candidates = extractEntities(content);
    const stored: Entity[] = [];
    for (const cand of candidates) {
      const e = this.graph.getOrCreateEntity(cand.name, cand.type);
      stored.push(e);
    }
    return stored;
  }

  /** Add an episodic record after an interaction. */
  addInteraction(conversationId: string, userId: string, userMessage: string, assistantMessage: string): void {
    // Extract entities from both messages
    const userEntities = extractEntities(userMessage);
    const assistantEntities = extractEntities(assistantMessage);
    const allEntities = [...userEntities, ...assistantEntities];

    const entityIds: string[] = [];
    for (const cand of allEntities) {
      const e = this.graph.getOrCreateEntity(cand.name, cand.type);
      entityIds.push(e.id);
    }

    // Build summary from first 100 chars of user message
    const summary = userMessage.slice(0, 120) + (userMessage.length > 120 ? '...' : '');
    this.graph.addEpisodic(conversationId, userId, summary, entityIds);

    // Add "talked_to" relationships between user and extracted entities
    for (const e of entityIds) {
      // Link user to entity
      const userEntity = this.graph.getOrCreateEntity(userId, 'person');
      this.graph.upsertRelationship(userEntity.id, e, 'talked_about', 0.5);
    }
  }

  /** Query graph memory for relevant context. */
  queryMemory(query: string, topK = 5): MemoryResult[] {
    return this.graph.search(query, topK);
  }

  /** Get all entities related to a given entity name. */
  getRelatedEntities(entityName: string, limit = 10) {
    const entity = this.graph.getEntityByName(entityName);
    if (!entity) return [];
    return this.graph.getRelatedEntities(entity.id, limit);
  }

  /** Build context string for system prompt injection. */
  buildMemoryContext(query: string, maxChars = 2000): string {
    return this.graph.buildContext(query, maxChars);
  }

  /** Consolidate graph memory (merge duplicates, compress old). */
  consolidateMemory(): { merged: number; deleted: number } {
    return this.graph.consolidate();
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
    this.graph.close();
  }
}

export { VectorStore } from './vector-store';
export { GraphMemory } from './graph-memory';
export type { Entity, MemoryResult, InteractionRecord } from './graph-memory';
