/**
 * GraphMemory — entity extraction + episodic/semantic memory layer.
 *
 * Stores entities (people, places, projects, facts) and their relationships
 * in SQLite tables, enabling cross-conversation recall and knowledge graph queries.
 *
 * Three memory types:
 *   Working  — context window (handled by MemoryManager.getRecent)
 *   Episodic — interaction sessions (who did what when)
 *   Semantic — facts/entities extracted from interactions
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  type: 'person' | 'project' | 'file' | 'concept' | 'event' | 'location' | 'unknown';
  name: string;
  properties: Record<string, string>;
  firstSeen: number;
  lastSeen: number;
}

export interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight: number;
  lastUpdated: number;
}

export interface EpisodicEntry {
  id: string;
  conversationId: string;
  userId: string;
  summary: string;
  timestamp: number;
  entities: string[]; // entity IDs involved
}

export interface MemoryResult {
  content: string;
  score: number;
  type: 'episodic' | 'semantic';
  source: string;
  entities?: string[];
}

export interface InteractionRecord {
  conversationId: string;
  summary: string;
  timestamp: number;
  entities: string[];
}

// ── Entity extraction (lightweight, no LLM) ───────────────────────────────────

const ENTITY_PATTERNS = {
  // Capitalized word sequences (proper nouns, names, projects)
  properNoun: /(?:[A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)/g,
  // @mentions
  mention: /@[a-zA-Z0-9_]{2,}/g,
  // URLs
  url: /https?:\/\/[^\s]+/g,
  // Hashtags
  hashtag: /#[a-zA-Z0-9_]+/g,
  // Code/file references (backtick paths or extension patterns)
  fileRef: /`([^`]+)`|\b[\w.-]+\.(ts|js|py|md|json|yaml|yml|sh|sql|html|css)\b/gi,
  // Quoted strings
  quoted: /"([^"]{2,50})"/g,
  // Dates
  date: /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b|\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
};

const ENTITY_TYPE_PRIORITY: Array<[string, RegExp]> = [
  ['url', ENTITY_PATTERNS.url],
  ['mention', ENTITY_PATTERNS.mention],
  ['hashtag', ENTITY_PATTERNS.hashtag],
  ['file', ENTITY_PATTERNS.fileRef],
  ['date', ENTITY_PATTERNS.date],
  ['person', ENTITY_PATTERNS.properNoun],
  ['concept', ENTITY_PATTERNS.quoted],
];

const MAX_INPUT_CHARS = 10_000;

/**
 * Extract candidate entities from a string using lightweight heuristics.
 * No LLM required.
 *
 * @param text - Input text to extract entities from. Must not exceed MAX_INPUT_CHARS.
 */
export function extractEntities(text: string): Array<{ name: string; type: Entity['type'] }> {
  const candidates: Array<{ name: string; type: Entity['type'] }> = [];
  const seen = new Set<string>();

  // ReDoS prevention: truncate input before regex processing
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  for (const [type, regex] of ENTITY_TYPE_PRIORITY) {
    // Reset regex lastIndex
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(input)) !== null) {
      const name = (match[1] ?? match[0]).trim();
      if (name.length < 2) continue;
      const key = `${type}:${name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ name, type: type as Entity['type'] });
      }
    }
  }

  return candidates;
}

// ── SQLite schema helper ────────────────────────────────────────────────────────

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS graph_entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS graph_relationships (
    id TEXT PRIMARY KEY,
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    rel_type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    last_updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS episodic_memory (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    entity_ids TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_entities_name ON graph_entities(name);
  CREATE INDEX IF NOT EXISTS idx_entities_type ON graph_entities(type);
  CREATE INDEX IF NOT EXISTS idx_rel_from ON graph_relationships(from_entity);
  CREATE INDEX IF NOT EXISTS idx_rel_to ON graph_relationships(to_entity);
  CREATE INDEX IF NOT EXISTS idx_episodic_conv ON episodic_memory(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_episodic_time ON episodic_memory(timestamp);
`;

// ── GraphMemory ────────────────────────────────────────────────────────────────

export class GraphMemory {
  private db: Database.Database;

  constructor(private dbPath = './data/graph-memory.db', db?: Database.Database) {
    if (db) {
      this.db = db;
    } else {
      const dir = path.dirname(dbPath);
      if (dir) fs.mkdirSync(dir, { recursive: true });
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.exec(CREATE_SQL);
    }
  }

  // ── Entity management ───────────────────────────────────────────────────────

/** Get or create entity by name */
  getOrCreateEntity(name: string, type: Entity['type'], properties: Record<string, string> = {}): Entity {
    const idKey = `${type}:${name.toLowerCase()}`;
    const existing = this.db.prepare('SELECT * FROM graph_entities WHERE type = ? AND name_lower = ?').get(type, name.toLowerCase()) as any;

    if (existing) {
      const props = JSON.parse(existing.properties || '{}');
      const updated = { ...props, ...properties };
      this.db.prepare('UPDATE graph_entities SET last_seen = ?, properties = ? WHERE id = ?')
        .run(Date.now(), JSON.stringify(updated), existing.id);
      return {
        id: existing.id,
        type: existing.type as Entity['type'],
        name: existing.name,
        properties: updated,
        firstSeen: existing.first_seen,
        lastSeen: Date.now(),
      };
    }

    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(
      'INSERT INTO graph_entities (id, type, name, properties, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, type, name, JSON.stringify(properties), Date.now(), Date.now());

    return { id, type, name, properties, firstSeen: Date.now(), lastSeen: Date.now() };
  }

  getEntity(id: string): Entity | null {
    const row = this.db.prepare('SELECT * FROM graph_entities WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id, type: row.type as Entity['type'], name: row.name,
      properties: JSON.parse(row.properties || '{}'),
      firstSeen: row.first_seen, lastSeen: row.last_seen,
    };
  }

  getEntityByName(name: string): Entity | null {
    const row = this.db.prepare('SELECT * FROM graph_entities WHERE name_lower = ?').get(name.toLowerCase()) as any;
    if (!row) return null;
    return {
      id: row.id, type: row.type as Entity['type'], name: row.name,
      properties: JSON.parse(row.properties || '{}'),
      firstSeen: row.first_seen, lastSeen: row.last_seen,
    };
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  upsertRelationship(fromId: string, toId: string, relType: string, weight = 1.0): void {
    const existing = this.db.prepare(
      'SELECT id, weight FROM graph_relationships WHERE from_entity = ? AND to_entity = ? AND rel_type = ?'
    ).get(fromId, toId, relType) as { id: string; weight: number } | undefined;

    if (existing) {
      this.db.prepare('UPDATE graph_relationships SET weight = ?, last_updated = ? WHERE id = ?')
        .run(existing.weight + weight, Date.now(), existing.id);
    } else {
      const id = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.db.prepare(
        'INSERT INTO graph_relationships (id, from_entity, to_entity, rel_type, weight, last_updated) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, fromId, toId, relType, weight, Date.now());
    }
  }

  getRelatedEntities(entityId: string, limit = 10): Array<{ entity: Entity; relationship: string; weight: number }> {
    const rows = this.db.prepare(`
      SELECT to_entity, rel_type, weight FROM graph_relationships
      WHERE from_entity = ? OR to_entity = ?
      ORDER BY weight DESC LIMIT ?
    `).all(entityId, entityId, limit) as Array<{ to_entity: string; rel_type: string; weight: number }>;

    return rows.map(row => {
      const otherId = row.to_entity === entityId
        ? (this.db.prepare('SELECT from_entity FROM graph_relationships WHERE id = ?').get(row.to_entity) as any)?.from_entity ?? row.to_entity
        : row.to_entity;
      const entity = this.getEntity(row.to_entity === entityId ? otherId : row.to_entity);
      return {
        entity: entity!,
        relationship: row.rel_type,
        weight: row.weight,
      };
    }).filter(r => r.entity != null);
  }

  // ── Episodic memory ────────────────────────────────────────────────────────

  addEpisodic(conversationId: string, userId: string, summary: string, entityIds: string[]): void {
    const id = `epi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare(
      'INSERT INTO episodic_memory (id, conversation_id, user_id, summary, timestamp, entity_ids) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, conversationId, userId, summary, Date.now(), JSON.stringify(entityIds));
  }

  getRecentEpisodes(conversationId?: string, limit = 10): InteractionRecord[] {
    let sql = 'SELECT * FROM episodic_memory';
    const params: any[] = [];
    if (conversationId) {
      sql += ' WHERE conversation_id = ?';
      params.push(conversationId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      conversationId: row.conversation_id,
      summary: row.summary,
      timestamp: row.timestamp,
      entities: JSON.parse(row.entity_ids || '[]'),
    }));
  }

  // ── Memory consolidation ───────────────────────────────────────────────────

  /**
   * Merge duplicate entities (same type + similar name).
   * Keep newest properties, sum relationship weights.
   */
  consolidate(): { merged: number; deleted: number } {
    let merged = 0, deleted = 0;

    // Find entities of same type with similar names
    const entities = this.db.prepare('SELECT * FROM graph_entities').all() as any[];
    const groups = new Map<string, any[]>();

    for (const e of entities) {
      const key = `${e.type}:${e.name.toLowerCase().split(/\s+/)[0]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    for (const [, group] of groups) {
      if (group.length < 2) continue;
      const [keep, ...duplicates] = group;
      for (const dup of duplicates) {
        // Transfer relationships
        this.db.prepare('UPDATE graph_relationships SET from_entity = ? WHERE from_entity = ?')
          .run(keep.id, dup.id);
        this.db.prepare('UPDATE graph_relationships SET to_entity = ? WHERE to_entity = ?')
          .run(keep.id, dup.id);
        // Update episodic references
        this.db.prepare(`
          UPDATE episodic_memory SET entity_ids = REPLACE(entity_ids, ?, ?)
          WHERE entity_ids LIKE ?
        `).run(`"${dup.id}"`, `"${keep.id}"`, `%${dup.id}%`);
        // Delete duplicate
        this.db.prepare('DELETE FROM graph_entities WHERE id = ?').run(dup.id);
        deleted++;
        merged++;
      }
    }

    return { merged, deleted };
  }

  // ── Query interface ────────────────────────────────────────────────────────

  /**
   * Full-text search across episodic summaries and entity names.
   * Returns ranked results with type indicator.
   */
  search(query: string, topK = 5): MemoryResult[] {
    const q = query.toLowerCase();
    const results: MemoryResult[] = [];

    // Search episodic
    const episodes = this.db.prepare(
      'SELECT * FROM episodic_memory WHERE summary LIKE ? ORDER BY timestamp DESC LIMIT ?'
    ).all(`%${q}%`, topK) as any[];

    for (const ep of episodes) {
      results.push({
        content: ep.summary,
        score: 1.0,
        type: 'episodic',
        source: ep.conversation_id,
        entities: JSON.parse(ep.entity_ids || '[]'),
      });
    }

    // Search entities
    const entities = this.db.prepare(
      'SELECT * FROM graph_entities WHERE name LIKE ? ORDER BY last_seen DESC LIMIT ?'
    ).all(`%${q}%`, topK) as any[];

    for (const e of entities) {
      const score = e.name.toLowerCase().includes(q) ? 0.9 : 0.5;
      results.push({
        content: `${e.type}: ${e.name}`,
        score,
        type: 'semantic',
        source: e.id,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Build context string from relevant memories for injection into system prompt.
   */
  buildContext(query: string, maxChars = 2000): string {
    const results = this.search(query, 10);
    let context = '## Relevant Memory\n\n';

    const episodic = results.filter(r => r.type === 'episodic');
    const semantic = results.filter(r => r.type === 'semantic');

    if (episodic.length > 0) {
      context += '### Past interactions\n';
      for (const r of episodic.slice(0, 3)) {
        context += `- ${r.content}\n`;
      }
    }

    if (semantic.length > 0) {
      context += '\n### Known entities\n';
      for (const r of semantic.slice(0, 5)) {
        context += `- ${r.content}\n`;
      }
    }

    return context.length > maxChars ? context.slice(0, maxChars) + '...' : context;
  }

  close(): void {
    this.db.close();
  }
}
