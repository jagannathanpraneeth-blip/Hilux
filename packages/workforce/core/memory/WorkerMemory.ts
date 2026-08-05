/**
 * WorkerMemory — Multi-tier cognitive memory for a single worker.
 *
 * Tier 1 - Working Memory: Current task context (in-process Map)
 * Tier 2 - Episodic Memory: Past task summaries (in-memory for scaffold; Redis/Qdrant in prod)
 * Tier 3 - Semantic Memory: Organizational knowledge facts
 * Tier 4 - Procedural Memory: Skills and how-to procedures
 */

export interface MemoryEntry {
  id: string;
  type: 'goal' | 'task_outcome' | 'learning' | 'decision' | 'message' | 'knowledge' | 'improvement';
  content: unknown;
  timestamp: Date;
  tags: string[];
}

export class WorkerMemory {
  private workerId: string;
  private department: string;

  // Tier 1 — Working memory
  private workingContext: Map<string, unknown> = new Map();

  // Tier 2 — Episodic memory
  private episodicStore: MemoryEntry[] = [];

  // Tier 3 — Semantic memory (injected from org knowledge base)
  private semanticStore: Map<string, string> = new Map();

  // Tier 4 — Procedural memory
  private proceduralStore: Map<string, string[]> = new Map();

  constructor(workerId: string, department: string) {
    this.workerId = workerId;
    this.department = department;
  }

  async loadOrganizationalContext(department: string): Promise<void> {
    this.workingContext.set('department', department);
    this.workingContext.set('loadedAt', new Date().toISOString());
  }

  async seedFromKnowledge(knowledge: Array<{ content: string; domain: string }>): Promise<void> {
    for (const k of knowledge) {
      this.semanticStore.set(k.domain, k.content);
    }
  }

  async recallForTask(taskDescription: string): Promise<{
    pastWork: string[];
    relevantKnowledge: string[];
    applicableSkills: string[];
  }> {
    const keywords = taskDescription.toLowerCase().split(' ');

    const pastWork = this.episodicStore
      .filter(e => e.type === 'task_outcome')
      .filter(e => keywords.some(k => JSON.stringify(e.content).toLowerCase().includes(k)))
      .slice(-5)
      .map(e => JSON.stringify(e.content));

    const relevantKnowledge = [...this.semanticStore.entries()]
      .filter(([domain]) => keywords.some(k => domain.includes(k)))
      .map(([, content]) => content);

    const applicableSkills = [...this.proceduralStore.entries()]
      .filter(([skill]) => keywords.some(k => skill.includes(k)))
      .flatMap(([, steps]) => steps);

    return { pastWork, relevantKnowledge, applicableSkills };
  }

  async storeGoal(goal: unknown): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'goal',
      content: goal,
      timestamp: new Date(),
      tags: ['goal'],
    });
    this.workingContext.set('currentGoal', goal);
  }

  async storeTaskOutcome(taskId: string, summary: string, outcome: string): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'task_outcome',
      content: { taskId, summary, outcome },
      timestamp: new Date(),
      tags: ['task', outcome],
    });
    this.workingContext.delete('currentGoal');
  }

  async storeLearning(learning: string, domains: string[]): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'learning',
      content: learning,
      timestamp: new Date(),
      tags: ['learning', ...domains],
    });

    // Also update procedural if it's a how-to
    if (learning.toLowerCase().startsWith('to ') || learning.toLowerCase().includes('always ')) {
      const domain = domains[0] ?? 'general';
      const existing = this.proceduralStore.get(domain) ?? [];
      this.proceduralStore.set(domain, [...existing, learning]);
    }
  }

  async storeDecision(decision: unknown): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'decision',
      content: decision,
      timestamp: new Date(),
      tags: ['decision'],
    });
  }

  async storeMessage(direction: 'sent' | 'received', message: unknown): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'message',
      content: { direction, message },
      timestamp: new Date(),
      tags: ['message', direction],
    });
  }

  async storeImprovementPlan(plan: unknown): Promise<void> {
    this.episodicStore.push({
      id: crypto.randomUUID(),
      type: 'improvement',
      content: plan,
      timestamp: new Date(),
      tags: ['improvement'],
    });
  }

  async absorb(knowledge: string): Promise<void> {
    const key = `absorbed_${Date.now()}`;
    this.semanticStore.set(key, knowledge);
  }

  async inject(data: Array<{ content: string }>): Promise<void> {
    for (const d of data) await this.absorb(d.content);
  }

  async resetWorkingContext(taskId: string): Promise<void> {
    this.workingContext.clear();
    this.workingContext.set('resetForTask', taskId);
  }

  async exportCurrentWorkContext(taskId: string): Promise<unknown> {
    return {
      taskId,
      workingContext: Object.fromEntries(this.workingContext),
      recentEpisodes: this.episodicStore.slice(-10),
    };
  }

  async exportAll(): Promise<Array<{ type: string; content: unknown; tags: string[] }>> {
    return [
      ...this.episodicStore,
      ...[...this.semanticStore.entries()].map(([k, v]) => ({
        id: k, type: 'knowledge', content: v, timestamp: new Date(), tags: ['semantic']
      })),
      ...[...this.proceduralStore.entries()].map(([k, v]) => ({
        id: k, type: 'procedure', content: { skill: k, steps: v }, timestamp: new Date(), tags: ['procedural']
      })),
    ];
  }
}
