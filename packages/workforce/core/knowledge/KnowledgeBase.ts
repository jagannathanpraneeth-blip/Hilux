/**
 * KnowledgeBase — Organizational and departmental knowledge store.
 *
 * Stores: learnings, procedures, facts, warnings, best practices.
 * Persisted across worker terminations — institutional memory.
 * In production: backed by Neo4j + Qdrant.
 */

export interface KnowledgeItem {
  id: string;
  type: 'learning' | 'procedure' | 'fact' | 'warning' | 'best_practice';
  content: string;
  domain: string;
  confidence: number;
  contributor: string;
  contributorRole: string;
  department: string;
  timestamp: Date;
  usageCount?: number;
  source?: string;
  preservedAt?: Date;
}

export class KnowledgeBase {
  private readonly namespace: string;
  private store: KnowledgeItem[] = [];

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  async store(item: Omit<KnowledgeItem, 'id' | 'usageCount'>): Promise<string> {
    const id = crypto.randomUUID();
    this.store.push({ ...item, id, usageCount: 0 });
    return id;
  }

  async bulkStore(items: Array<Omit<KnowledgeItem, 'id' | 'usageCount'>>): Promise<void> {
    for (const item of items) await this.store(item);
  }

  async retrieve(domains: string[]): Promise<Array<{ content: string; domain: string }>> {
    return this.store
      .filter(item => domains.some(d => item.domain.includes(d) || d.includes(item.domain)))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 20)
      .map(item => ({ content: item.content, domain: item.domain }));
  }

  async retrieveForError(errorDescription: string): Promise<Array<{ content: string }>> {
    const keywords = errorDescription.toLowerCase().split(' ');
    return this.store
      .filter(item =>
        item.type === 'warning' ||
        keywords.some(k => item.content.toLowerCase().includes(k))
      )
      .slice(0, 10)
      .map(item => ({ content: item.content }));
  }

  async size(): Promise<number> {
    return this.store.length;
  }

  async search(query: string): Promise<KnowledgeItem[]> {
    const lower = query.toLowerCase();
    return this.store
      .filter(item => item.content.toLowerCase().includes(lower))
      .slice(0, 10);
  }
}
