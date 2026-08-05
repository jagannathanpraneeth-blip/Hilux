/**
 * Memory Manager — Application service coordinating multi-tier memory access.
 *
 * This is the single entry point for all agent memory operations.
 * It abstracts the four-tier cognitive architecture from agents.
 *
 * Agents never talk to Redis, Qdrant, or Neo4j directly.
 * They talk to the MemoryManager via its port interface.
 * This allows swapping memory implementations transparently.
 *
 * Architecture decisions:
 *   - Parallel retrieval from episodic + semantic + procedural (faster)
 *   - Token-budget-aware compression (context window management)
 *   - Source attribution for provenance tracking
 *   - Graceful degradation: if one tier fails, others still serve
 */

export interface ContextRequest {
  agentInstanceId: string;
  missionId: string;
  taskId: string;
  orgId: string;
  taskDescription: string;
  taskType: string;
  agentCapabilityTags: string[];
  tokenBudget: number; // Max tokens for retrieved context
}

export interface MemorySource {
  tier: 'working' | 'episodic' | 'semantic' | 'procedural';
  content: string;
  relevanceScore: number;
  sourceId: string;     // For provenance tracking
  tokenCount: number;
}

export interface ContextBundle {
  workingMemory: MemorySource[];
  episodicMemory: MemorySource[];
  semanticMemory: MemorySource[];
  proceduralMemory: MemorySource[];
  totalTokens: number;
  retrievalLatencyMs: number;
  truncated: boolean; // True if content was cut to fit token budget
}

export interface WorkingMemoryContext {
  recentToolOutputs: Array<{ tool: string; output: unknown; timestamp: Date }>;
  agentScratchpad: string;
  activeTaskSpec: string;
  recentAgentDialogue: Array<{ role: 'self' | 'orchestrator'; content: string }>;
}

// ─── Ports (interfaces for infrastructure adapters) ───

export interface IWorkingMemoryStore {
  get(agentInstanceId: string): Promise<WorkingMemoryContext | null>;
  set(agentInstanceId: string, context: WorkingMemoryContext): Promise<void>;
  appendToolOutput(agentInstanceId: string, tool: string, output: unknown): Promise<void>;
  clear(agentInstanceId: string): Promise<void>;
}

export interface IEpisodicMemoryStore {
  searchSimilar(options: {
    queryEmbedding: number[];
    orgId: string;
    filters?: { taskType?: string; outcome?: string[] };
    topK: number;
    scoreThreshold: number;
  }): Promise<Array<{ episodeText: string; score: number; episodeId: string; outcome: string }>>;

  storeEpisode(episode: {
    orgId: string;
    missionId: string;
    taskId: string;
    agentType: string;
    taskType: string;
    episodeText: string;
    embedding: number[];
    outcome: 'success' | 'failure' | 'partial';
  }): Promise<string>;
}

export interface ISemanticMemoryStore {
  query(options: {
    orgId: string;
    seedConcepts: string[];
    maxHops: number;
    maxNodes: number;
  }): Promise<Array<{ concept: string; relationships: string[]; confidence: number; nodeId: string }>>;

  mergeKnowledge(knowledge: {
    orgId: string;
    missionId: string;
    concepts: Array<{ name: string; domain: string; facts: string[] }>;
  }): Promise<void>;
}

export interface IProceduralMemoryStore {
  findApplicable(options: {
    orgId: string;
    taskType: string;
    capabilityTags: string[];
    minConfidence: number;
  }): Promise<Array<{ skillName: string; procedure: string; successRate: number; skillId: string }>>;
}

export interface IEmbeddingService {
  embed(text: string): Promise<number[]>;
}

// ─── Application Service ───

export class MemoryManager {
  constructor(
    private readonly workingStore: IWorkingMemoryStore,
    private readonly episodicStore: IEpisodicMemoryStore,
    private readonly semanticStore: ISemanticMemoryStore,
    private readonly proceduralStore: IProceduralMemoryStore,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async assembleContext(request: ContextRequest): Promise<ContextBundle> {
    const startMs = Date.now();

    // 1. Working memory (always first, synchronous per agent)
    const working = await this.workingStore.get(request.agentInstanceId);

    // 2. Generate embedding for retrieval
    const queryEmbedding = await this.embeddingService.embed(
      `${request.taskDescription} ${request.taskType}`
    );

    // 3. Parallel retrieval from episodic, semantic, procedural
    const [episodicResults, semanticResults, proceduralResults] = await Promise.allSettled([
      this.episodicStore.searchSimilar({
        queryEmbedding,
        orgId: request.orgId,
        filters: { outcome: ['success'] },
        topK: 10,
        scoreThreshold: 0.72,
      }),
      this.semanticStore.query({
        orgId: request.orgId,
        seedConcepts: this.extractConcepts(request.taskDescription),
        maxHops: 3,
        maxNodes: 50,
      }),
      this.proceduralStore.findApplicable({
        orgId: request.orgId,
        taskType: request.taskType,
        capabilityTags: request.agentCapabilityTags,
        minConfidence: 0.80,
      }),
    ]);

    // 4. Build memory sources with graceful degradation
    const workingMemorySources = this.buildWorkingMemorySources(working);
    const episodicSources = episodicResults.status === 'fulfilled'
      ? this.buildEpisodicSources(episodicResults.value)
      : [];
    const semanticSources = semanticResults.status === 'fulfilled'
      ? this.buildSemanticSources(semanticResults.value)
      : [];
    const proceduralSources = proceduralResults.status === 'fulfilled'
      ? this.buildProceduralSources(proceduralResults.value)
      : [];

    // 5. Compress to token budget (working memory has priority)
    const workingTokens = this.countTokens(workingMemorySources);
    const remainingBudget = request.tokenBudget - workingTokens;

    const { selected, truncated } = this.selectWithinBudget(
      [...episodicSources, ...semanticSources, ...proceduralSources],
      remainingBudget
    );

    return {
      workingMemory: workingMemorySources,
      episodicMemory: selected.filter(s => s.tier === 'episodic'),
      semanticMemory: selected.filter(s => s.tier === 'semantic'),
      proceduralMemory: selected.filter(s => s.tier === 'procedural'),
      totalTokens: workingTokens + this.countTokens(selected),
      retrievalLatencyMs: Date.now() - startMs,
      truncated,
    };
  }

  async storeEpisode(params: {
    orgId: string;
    missionId: string;
    taskId: string;
    agentType: string;
    taskType: string;
    episodeText: string;
    outcome: 'success' | 'failure' | 'partial';
  }): Promise<void> {
    const embedding = await this.embeddingService.embed(params.episodeText);
    await this.episodicStore.storeEpisode({ ...params, embedding });
  }

  private extractConcepts(text: string): string[] {
    // Simple extraction: named entities, noun phrases
    // In production: use NER model or LLM extraction
    const words = text.split(/\s+/);
    return words
      .filter(w => w.length > 4 && /^[A-Z]/.test(w))
      .slice(0, 10);
  }

  private buildWorkingMemorySources(context: WorkingMemoryContext | null): MemorySource[] {
    if (!context) return [];
    return [{
      tier: 'working',
      content: JSON.stringify(context),
      relevanceScore: 1.0,
      sourceId: 'working_memory',
      tokenCount: Math.ceil(JSON.stringify(context).length / 4),
    }];
  }

  private buildEpisodicSources(results: Awaited<ReturnType<IEpisodicMemoryStore['searchSimilar']>>): MemorySource[] {
    return results.map(r => ({
      tier: 'episodic' as const,
      content: r.episodeText,
      relevanceScore: r.score,
      sourceId: r.episodeId,
      tokenCount: Math.ceil(r.episodeText.length / 4),
    }));
  }

  private buildSemanticSources(results: Awaited<ReturnType<ISemanticMemoryStore['query']>>): MemorySource[] {
    return results.map(r => ({
      tier: 'semantic' as const,
      content: `${r.concept}: ${r.relationships.join(', ')}`,
      relevanceScore: r.confidence,
      sourceId: r.nodeId,
      tokenCount: Math.ceil((r.concept.length + r.relationships.join('').length) / 4),
    }));
  }

  private buildProceduralSources(results: Awaited<ReturnType<IProceduralMemoryStore['findApplicable']>>): MemorySource[] {
    return results.map(r => ({
      tier: 'procedural' as const,
      content: `Skill: ${r.skillName}\n${r.procedure}`,
      relevanceScore: r.successRate,
      sourceId: r.skillId,
      tokenCount: Math.ceil((r.skillName.length + r.procedure.length) / 4),
    }));
  }

  private countTokens(sources: MemorySource[]): number {
    return sources.reduce((sum, s) => sum + s.tokenCount, 0);
  }

  private selectWithinBudget(
    sources: MemorySource[],
    budget: number
  ): { selected: MemorySource[]; truncated: boolean } {
    // Sort by relevance descending
    const sorted = [...sources].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selected: MemorySource[] = [];
    let used = 0;

    for (const source of sorted) {
      if (used + source.tokenCount <= budget) {
        selected.push(source);
        used += source.tokenCount;
      }
    }

    return { selected, truncated: selected.length < sources.length };
  }
}
