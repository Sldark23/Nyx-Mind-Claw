/**
 * VectorStore — semantic search over conversation history.
 *
 * Uses TF-IDF + cosine similarity for lightweight semantic search
 * without requiring an external vector DB (pgvector, qdrant, etc).
 *
 * Fallback: if the user has qdrant/pgvector configured, use that instead.
 */
import { MemoryManager } from '../memory';

interface SearchResult {
  content: string;
  score: number;
  conversationId: string;
  role: string;
}

export class VectorStore {
  private index: Map<string, { tfidf: Map<string, number>; content: string; role: string; conversationId: string }> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;

  constructor(private memory: MemoryManager) {}

  /**
   * Index all messages from a conversation.
   */
  indexConversation(conversationId: string): void {
    const messages = this.memory.getRecent(conversationId, 1000);
    for (const msg of messages) {
      this.addDocument(conversationId, msg.role, msg.content);
    }
  }

  /**
   * Add a single document to the index.
   */
  private addDocument(conversationId: string, role: string, content: string): void {
    const tokens = this.tokenize(content);
    if (tokens.length === 0) return;

    const tf = this.termFrequency(tokens);
    const id = `${conversationId}:${this.documentCount++}`;
    this.index.set(id, { tfidf: tf, content, role, conversationId });
    this.updateIDF(tokens);
  }

  /**
   * Semantic search — returns top-k results.
   */
  search(query: string, topK = 5): SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const queryTF = this.termFrequency(queryTokens);
    const queryVector = this.tfidfVector(queryTF);

    const results: SearchResult[] = [];

    for (const [, doc] of this.index) {
      const score = this.cosineSimilarity(queryVector, doc.tfidf);
      results.push({ content: doc.content, score, conversationId: doc.conversationId, role: doc.role });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private termFrequency(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    for (const [token, count] of tf) {
      tf.set(token, count / tokens.length);
    }
    return tf;
  }

  private updateIDF(tokens: string[]): void {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      const current = this.idf.get(term) || 0;
      this.idf.set(term, current + 1);
    }
  }

  private idfScore(term: string): number {
    const docFreq = this.idf.get(term) || 1;
    return Math.log((this.documentCount + 1) / (docFreq + 1)) + 1;
  }

  private tfidfVector(tf: Map<string, number>): Map<string, number> {
    const vec = new Map<string, number>();
    for (const [term, tfScore] of tf) {
      vec.set(term, tfScore * this.idfScore(term));
    }
    return vec;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (const [term, va] of a) {
      const vb = b.get(term) || 0;
      dot += va * vb;
      normA += va * va;
    }
    for (const [, vb] of b) {
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
