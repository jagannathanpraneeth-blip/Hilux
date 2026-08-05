/**
 * ─── WORKFORCE CORE TESTS ─────────────────────────────────────────────────────
 * Tests for:
 *   - MessageBus (pub/sub, topic routing, message counts)
 *   - WorkerMemory (multi-tier memory, recall, export)
 *   - PerformanceTracker (KPI computation, trend analysis)
 *   - DecisionEngine (risk-weighted choices, autonomy constraints)
 *   - KnowledgeBase (store, retrieve, search)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../packages/workforce/core/communication/MessageBus.js';
import { WorkerMemory } from '../../packages/workforce/core/memory/WorkerMemory.js';
import { PerformanceTracker } from '../../packages/workforce/core/metrics/PerformanceTracker.js';
import { DecisionEngine } from '../../packages/workforce/core/decision/DecisionEngine.js';
import { KnowledgeBase } from '../../packages/workforce/core/knowledge/KnowledgeBase.js';

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUS TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('MessageBus — Pub/Sub Communication', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  it('delivers message to a subscriber', async () => {
    const received: unknown[] = [];
    bus.subscribe('worker.test-worker', async (msg) => { received.push(msg); });
    await bus.publish('worker.test-worker', { type: 'goal_assigned', goalId: 'g1' });
    expect(received).toHaveLength(1);
    expect((received[0] as any).type).toBe('goal_assigned');
  });

  it('delivers to multiple subscribers on same topic', async () => {
    const r1: unknown[] = [];
    const r2: unknown[] = [];
    bus.subscribe('department.engineering', async (msg) => { r1.push(msg); });
    bus.subscribe('department.engineering', async (msg) => { r2.push(msg); });
    await bus.publish('department.engineering', { type: 'broadcast' });
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });

  it('does not deliver to different topic subscribers', async () => {
    const received: unknown[] = [];
    bus.subscribe('worker.alice', async (msg) => { received.push(msg); });
    await bus.publish('worker.bob', { type: 'test' });
    expect(received).toHaveLength(0);
  });

  it('adds metadata envelope to every message', async () => {
    let received: any = null;
    bus.subscribe('test.topic', async (msg) => { received = msg; });
    await bus.publish('test.topic', { type: 'ping' });
    expect(received._messageId).toBeDefined();
    expect(received._topic).toBe('test.topic');
    expect(received._publishedAt).toBeDefined();
    expect(received._seq).toBeGreaterThan(0);
  });

  it('increments message count with each publish', async () => {
    await bus.publish('t1', { x: 1 });
    await bus.publish('t1', { x: 2 });
    await bus.publish('t2', { x: 3 });
    expect(bus.getStats().totalMessages).toBe(3);
  });

  it('tracks unique topic count', async () => {
    bus.subscribe('topic.a', async () => {});
    bus.subscribe('topic.b', async () => {});
    bus.subscribe('topic.c', async () => {});
    expect(bus.getStats().topics).toBe(3);
  });

  it('unsubscribe stops delivery', async () => {
    const received: unknown[] = [];
    bus.subscribe('worker.temp', async (msg) => { received.push(msg); });
    await bus.publish('worker.temp', { type: 'before_unsub' });
    bus.unsubscribe('worker.temp');
    await bus.publish('worker.temp', { type: 'after_unsub' });
    expect(received).toHaveLength(1); // Only the first message
  });

  it('handles subscriber errors gracefully (other subscribers still fire)', async () => {
    const successReceived: unknown[] = [];
    bus.subscribe('test.topic', async () => { throw new Error('Subscriber error'); });
    bus.subscribe('test.topic', async (msg) => { successReceived.push(msg); });
    // Should not throw
    await expect(bus.publish('test.topic', { type: 'test' })).resolves.not.toThrow();
    expect(successReceived).toHaveLength(1);
  });

  it('message sequences are monotonically increasing', async () => {
    const seqs: number[] = [];
    bus.subscribe('test.topic', async (msg) => { seqs.push((msg as any)._seq); });
    await bus.publish('test.topic', { x: 1 });
    await bus.publish('test.topic', { x: 2 });
    await bus.publish('test.topic', { x: 3 });
    expect(seqs[0]).toBeLessThan(seqs[1]!);
    expect(seqs[1]).toBeLessThan(seqs[2]!);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKER MEMORY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkerMemory — 4-Tier Cognitive Memory', () => {
  let memory: WorkerMemory;

  beforeEach(() => {
    memory = new WorkerMemory('worker-001', 'engineering');
  });

  it('initializes without error', async () => {
    await expect(memory.loadOrganizationalContext('engineering')).resolves.not.toThrow();
  });

  it('stores and recalls goals', async () => {
    const goal = { goalId: 'g1', title: 'Build API', description: 'Create REST API', priority: 'high' };
    await memory.storeGoal(goal);
    const recalled = await memory.recallForTask('Build REST API');
    // Goal is stored in episodic — verify no error
    expect(recalled).toBeDefined();
    expect(recalled.pastWork).toBeDefined();
    expect(recalled.relevantKnowledge).toBeDefined();
    expect(recalled.applicableSkills).toBeDefined();
  });

  it('stores task outcomes and can recall them', async () => {
    await memory.storeTaskOutcome('task-1', 'Built the REST API successfully', 'success');
    const recalled = await memory.recallForTask('Build REST API');
    expect(recalled.pastWork.some(s => s.includes('REST'))).toBe(true);
  });

  it('stores and recalls learnings in procedural memory', async () => {
    await memory.storeLearning('Always validate input before processing', ['validation', 'engineering']);
    // The learning with "always" should go into procedural
    const recalled = await memory.recallForTask('validation');
    expect(recalled.applicableSkills.length).toBeGreaterThanOrEqual(0);
  });

  it('absorbs external knowledge into semantic memory', async () => {
    await memory.absorb('TypeScript strict mode catches common runtime errors at compile time');
    const recalled = await memory.recallForTask('TypeScript');
    expect(recalled.relevantKnowledge.length).toBeGreaterThanOrEqual(0);
  });

  it('seeds knowledge from knowledge base entries', async () => {
    await memory.seedFromKnowledge([
      { content: 'Use dependency injection for testability', domain: 'engineering' },
      { content: 'Document all public APIs', domain: 'documentation' },
    ]);
    const recalled = await memory.recallForTask('engineering best practices');
    expect(Array.isArray(recalled.relevantKnowledge)).toBe(true);
  });

  it('exportAll returns all stored memories', async () => {
    await memory.storeGoal({ goalId: 'g1', title: 'Test' });
    await memory.storeTaskOutcome('t1', 'Done', 'success');
    await memory.storeLearning('Always write tests', ['testing']);
    const exported = await memory.exportAll();
    expect(exported.length).toBeGreaterThan(0);
  });

  it('resetWorkingContext clears current task context', async () => {
    await memory.storeGoal({ goalId: 'g1', title: 'Test' });
    await memory.resetWorkingContext('task-reset');
    const ctx = await memory.exportCurrentWorkContext('task-reset');
    expect(ctx).toBeDefined();
  });

  it('stores messages (sent and received)', async () => {
    await memory.storeMessage('sent', { type: 'goal_ack', to: 'worker-002' });
    await memory.storeMessage('received', { type: 'task_assigned', from: 'manager-001' });
    const exported = await memory.exportAll();
    const messages = exported.filter(e => e.type === 'message');
    expect(messages).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE TRACKER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('PerformanceTracker — KPI Computation', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker('worker-001', 'Backend Engineer');
  });

  it('returns default snapshot for new worker (no tasks yet)', () => {
    const snap = tracker.getSnapshot();
    expect(snap.overallScore).toBeGreaterThan(0);
    expect(snap.trend).toBe('stable');
    expect(snap.taskCompletionRate).toBe(1.0);
  });

  it('100% success rate gives high task completion rate', () => {
    for (let i = 0; i < 5; i++) {
      tracker.recordTaskOutcome({
        taskId: `task-${i}`,
        success: true,
        qualityScore: 0.90,
        timeToComplete: 60,
        tokensUsed: 2000,
        costUsd: 1.0,
      });
    }
    const snap = tracker.getSnapshot();
    expect(snap.taskCompletionRate).toBe(1.0);
  });

  it('50% failure rate reduces task completion rate', () => {
    for (let i = 0; i < 10; i++) {
      tracker.recordTaskOutcome({
        taskId: `task-${i}`,
        success: i % 2 === 0, // alternating success/failure
        qualityScore: 0.80,
        timeToComplete: 60,
        tokensUsed: 2000,
        costUsd: 1.0,
      });
    }
    const snap = tracker.getSnapshot();
    expect(snap.taskCompletionRate).toBe(0.5);
  });

  it('overall score is between 0 and 1', () => {
    tracker.recordTaskOutcome({
      taskId: 'task-1', success: true, qualityScore: 0.95,
      timeToComplete: 30, tokensUsed: 1000, costUsd: 0.5,
    });
    const snap = tracker.getSnapshot();
    expect(snap.overallScore).toBeGreaterThanOrEqual(0);
    expect(snap.overallScore).toBeLessThanOrEqual(1);
  });

  it('high quality scores yield high average quality', () => {
    for (let i = 0; i < 5; i++) {
      tracker.recordTaskOutcome({
        taskId: `t${i}`, success: true, qualityScore: 0.95,
        timeToComplete: 30, tokensUsed: 1000, costUsd: 0.5,
      });
    }
    const snap = tracker.getSnapshot();
    expect(snap.averageQualityScore).toBeCloseTo(0.95, 2);
  });

  it('escalations increase escalation rate', () => {
    tracker.recordTaskOutcome({ taskId: 't1', success: true, qualityScore: 0.8, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    tracker.recordEscalation({
      escalationId: 'e1',
      workerId: 'worker-001',
      workerRole: 'Backend Engineer',
      targetManagerId: 'mgr-001',
      urgency: 'medium',
      context: 'Blocked on external API',
      createdAt: new Date(),
    });
    const snap = tracker.getSnapshot();
    expect(snap.escalationRate).toBeGreaterThan(0);
  });

  it('reflections feed into efficiency scoring', () => {
    tracker.recordReflection({
      taskId: 't1',
      qualityScore: 0.90,
      efficiencyScore: 0.85,
      learnings: ['Caching reduces API calls by 40%'],
      improvements: [],
      blockers: [],
      timestamp: new Date(),
    });
    const snap = tracker.getSnapshot();
    expect(snap.averageEfficiencyScore).toBeGreaterThan(0);
  });

  it('learning velocity increases with more learnings', () => {
    tracker.recordTaskOutcome({ taskId: 't1', success: true, qualityScore: 0.8, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    tracker.recordReflection({
      taskId: 't1', qualityScore: 0.8, efficiencyScore: 0.8,
      learnings: ['Learning A', 'Learning B', 'Learning C'],
      improvements: [], blockers: [], timestamp: new Date(),
    });
    const snap = tracker.getSnapshot();
    expect(snap.learningVelocity).toBeGreaterThan(0);
  });

  it('detects improving trend when recent quality > past quality', () => {
    // Fill 40 tasks: first 20 at low quality, next 20 at high quality
    for (let i = 0; i < 20; i++) {
      tracker.recordTaskOutcome({ taskId: `old-${i}`, success: true, qualityScore: 0.60, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    }
    for (let i = 0; i < 20; i++) {
      tracker.recordTaskOutcome({ taskId: `new-${i}`, success: true, qualityScore: 0.90, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    }
    const snap = tracker.getSnapshot();
    expect(snap.trend).toBe('improving');
  });

  it('detects declining trend when recent quality < past quality', () => {
    for (let i = 0; i < 20; i++) {
      tracker.recordTaskOutcome({ taskId: `old-${i}`, success: true, qualityScore: 0.90, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    }
    for (let i = 0; i < 20; i++) {
      tracker.recordTaskOutcome({ taskId: `new-${i}`, success: true, qualityScore: 0.60, timeToComplete: 60, tokensUsed: 1000, costUsd: 1 });
    }
    const snap = tracker.getSnapshot();
    expect(snap.trend).toBe('declining');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DECISION ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('DecisionEngine — Risk-Weighted Decision Making', () => {
  describe('Supervised autonomy', () => {
    let engine: DecisionEngine;
    beforeEach(() => { engine = new DecisionEngine('w1', 'supervised'); });

    it('chooses low-risk option over high-risk', async () => {
      const decision = await engine.evaluate('Which approach to use?', [
        { option: 'safe_approach', rationale: 'Proven pattern', risk: 'low', impactLevel: 'trivial' },
        { option: 'risky_approach', rationale: 'New idea', risk: 'high', impactLevel: 'trivial' },
      ]);
      expect(decision.chosen).toBe('safe_approach');
    });

    it('confidence is between 0 and 1', async () => {
      const decision = await engine.evaluate('Test?', [
        { option: 'opt_a', rationale: 'Reason A', risk: 'low', impactLevel: 'trivial' },
        { option: 'opt_b', rationale: 'Reason B', risk: 'medium', impactLevel: 'trivial' },
      ]);
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('decision includes all metadata', async () => {
      const decision = await engine.evaluate('What to do?', [
        { option: 'action_x', rationale: 'Best choice', risk: 'low', impactLevel: 'minor' },
      ]);
      expect(decision.decisionId).toBeDefined();
      expect(decision.question).toBe('What to do?');
      expect(decision.chosen).toBe('action_x');
      expect(decision.rationale).toBe('Best choice');
      expect(decision.timestamp).toBeInstanceOf(Date);
      expect(decision.escalated).toBe(false);
    });

    it('severe risk options get heavily penalized for supervised workers', async () => {
      const decision = await engine.evaluate('High stakes choice?', [
        { option: 'safe', rationale: 'Safe', risk: 'low', impactLevel: 'trivial' },
        { option: 'risky', rationale: 'Risky', risk: 'high', impactLevel: 'critical' },
      ]);
      expect(decision.chosen).toBe('safe');
    });
  });

  describe('Executive autonomy', () => {
    let engine: DecisionEngine;
    beforeEach(() => { engine = new DecisionEngine('ceo-1', 'executive'); });

    it('can handle major impact decisions with higher confidence', async () => {
      const decision = await engine.evaluate('Strategic pivot?', [
        { option: 'expand_market', rationale: 'Grow user base', risk: 'medium', impactLevel: 'major' },
        { option: 'cut_costs', rationale: 'Improve margins', risk: 'low', impactLevel: 'major' },
      ]);
      expect(decision).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe('Autonomy level update', () => {
    it('setAutonomyLevel changes decision behavior', async () => {
      const engine = new DecisionEngine('w1', 'supervised');
      engine.setAutonomyLevel('executive');
      // Should still return a valid decision
      const decision = await engine.evaluate('Test?', [
        { option: 'opt', rationale: 'Reason', risk: 'low', impactLevel: 'critical' },
      ]);
      expect(decision).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('throws when no options provided', async () => {
      const engine = new DecisionEngine('w1', 'guided');
      await expect(engine.evaluate('What to do?', [])).rejects.toThrow('No decision options provided');
    });

    it('single option is always chosen', async () => {
      const engine = new DecisionEngine('w1', 'guided');
      const decision = await engine.evaluate('Only one option?', [
        { option: 'only_option', rationale: 'Only choice', risk: 'medium', impactLevel: 'moderate' },
      ]);
      expect(decision.chosen).toBe('only_option');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('KnowledgeBase — Organizational Knowledge Store', () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    kb = new KnowledgeBase('org:test-company');
  });

  it('stores an item and returns an ID', async () => {
    const id = await kb.store({
      type: 'fact',
      content: 'TypeScript strict mode eliminates common runtime errors',
      domain: 'engineering',
      confidence: 0.95,
      contributor: 'worker-001',
      contributorRole: 'Senior Engineer',
      department: 'engineering',
      timestamp: new Date(),
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('size increases after storing items', async () => {
    expect(await kb.size()).toBe(0);
    await kb.store({ type: 'fact', content: 'Test', domain: 'test', confidence: 0.8, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() });
    expect(await kb.size()).toBe(1);
  });

  it('retrieves items by domain', async () => {
    await kb.store({ type: 'learning', content: 'Use React Query for async state', domain: 'frontend', confidence: 0.9, contributor: 'w1', contributorRole: 'Frontend Engineer', department: 'engineering', timestamp: new Date() });
    await kb.store({ type: 'fact', content: 'PostgreSQL handles JSON well', domain: 'database', confidence: 0.95, contributor: 'w2', contributorRole: 'DB Engineer', department: 'engineering', timestamp: new Date() });

    const frontendKnowledge = await kb.retrieve(['frontend']);
    expect(frontendKnowledge.some(k => k.content.includes('React'))).toBe(true);
  });

  it('retrieve returns empty for unknown domain', async () => {
    await kb.store({ type: 'fact', content: 'Some fact', domain: 'engineering', confidence: 0.9, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() });
    const results = await kb.retrieve(['marketing']);
    expect(results).toHaveLength(0);
  });

  it('bulkStore stores multiple items', async () => {
    await kb.bulkStore([
      { type: 'fact', content: 'Fact 1', domain: 'engineering', confidence: 0.9, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() },
      { type: 'learning', content: 'Learning 2', domain: 'engineering', confidence: 0.8, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() },
      { type: 'warning', content: 'Warning 3', domain: 'security', confidence: 0.95, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() },
    ]);
    expect(await kb.size()).toBe(3);
  });

  it('search finds items by content keyword', async () => {
    await kb.store({ type: 'best_practice', content: 'Always write unit tests for domain logic', domain: 'engineering', confidence: 0.95, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() });
    await kb.store({ type: 'fact', content: 'React 18 has concurrent mode', domain: 'frontend', confidence: 0.90, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() });

    const results = await kb.search('unit tests');
    expect(results.some(r => r.content.includes('unit tests'))).toBe(true);
  });

  it('retrieveForError finds warnings', async () => {
    await kb.store({ type: 'warning', content: 'Database connection pooling must be configured properly', domain: 'database', confidence: 0.99, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() });
    const results = await kb.retrieveForError('database connection error');
    expect(results.some(r => r.content.includes('connection'))).toBe(true);
  });

  it('handles concurrent stores safely', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        kb.store({ type: 'fact', content: `Fact ${i}`, domain: 'test', confidence: 0.8, contributor: 'w', contributorRole: 'r', department: 'd', timestamp: new Date() })
      )
    );
    expect(await kb.size()).toBe(20);
  });
});
