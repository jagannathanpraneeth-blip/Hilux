/**
 * ─── MISSION DOMAIN TESTS ────────────────────────────────────────────────────
 * Tests for the core Mission bounded context:
 *   - Goal value object (validation)
 *   - MissionBudget value object (validation + exceeded logic)
 *   - MissionStatus state machine (valid + invalid transitions)
 *   - MissionAggregate (full lifecycle, events, invariants)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Goal } from '../../packages/core/mission/domain/value-objects/Goal.js';
import { MissionBudget } from '../../packages/core/mission/domain/value-objects/MissionBudget.js';
import {
  MissionStatus,
  canTransition,
  MISSION_TRANSITIONS,
} from '../../packages/core/mission/domain/value-objects/MissionStatus.js';
import { MissionAggregate } from '../../packages/core/mission/domain/aggregates/MissionAggregate.js';
import type { MissionDAG } from '../../packages/core/mission/domain/aggregates/MissionAggregate.js';

// ─────────────────────────────────────────────────────────────────────────────
// GOAL VALUE OBJECT
// ─────────────────────────────────────────────────────────────────────────────

describe('Goal — Value Object', () => {
  describe('Goal.create() — validation', () => {
    it('creates a valid goal with sufficient text', () => {
      const result = Goal.create('Analyze our top competitors and produce a strategic response plan');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().text).toBe('Analyze our top competitors and produce a strategic response plan');
    });

    it('trims whitespace from goal text', () => {
      const result = Goal.create('  Build the product roadmap for Q4  ');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().text).toBe('Build the product roadmap for Q4');
    });

    it('fails when goal is too short (under 10 chars)', () => {
      const result = Goal.create('Short');
      expect(result.isFailure()).toBe(true);
      expect(result.unwrapError().message).toContain('at least 10 characters');
    });

    it('fails for empty string', () => {
      const result = Goal.create('');
      expect(result.isFailure()).toBe(true);
    });

    it('fails for whitespace-only string', () => {
      const result = Goal.create('   ');
      expect(result.isFailure()).toBe(true);
    });

    it('fails when goal exceeds 4000 characters', () => {
      const longText = 'a'.repeat(4001);
      const result = Goal.create(longText);
      expect(result.isFailure()).toBe(true);
      expect(result.unwrapError().message).toContain('maximum length');
    });

    it('accepts exactly 4000 character goal', () => {
      const exactText = 'a'.repeat(4000);
      const result = Goal.create(exactText);
      expect(result.isOk()).toBe(true);
    });

    it('accepts exactly 10 character goal', () => {
      const result = Goal.create('0123456789');
      expect(result.isOk()).toBe(true);
    });
  });

  describe('Goal — immutability and equality', () => {
    it('two goals with same text are equal', () => {
      const a = Goal.create('Build the product roadmap for Q4').unwrap();
      const b = Goal.create('Build the product roadmap for Q4').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('two goals with different text are not equal', () => {
      const a = Goal.create('Build the product roadmap for Q4').unwrap();
      const b = Goal.create('Build the product roadmap for Q3').unwrap();
      expect(a.equals(b)).toBe(false);
    });

    it('withEmbedding creates a new Goal with vector', () => {
      const goal = Goal.create('Build the product roadmap for Q4').unwrap();
      const vector = [0.1, 0.2, 0.3, 0.4];
      const embedded = goal.withEmbedding(vector);
      expect(embedded.embeddingVector).toEqual(vector);
      expect(goal.embeddingVector).toBeUndefined(); // original unchanged
    });

    it('toString returns text', () => {
      const text = 'Build the product roadmap for Q4';
      const goal = Goal.create(text).unwrap();
      expect(goal.toString()).toBe(text);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MISSION BUDGET VALUE OBJECT
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionBudget — Value Object', () => {
  describe('MissionBudget.create() — validation', () => {
    it('creates a valid budget', () => {
      const result = MissionBudget.create(100, 24);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().maxCostUsd).toBe(100);
      expect(result.unwrap().maxDurationHours).toBe(24);
    });

    it('fails when cost is negative', () => {
      const result = MissionBudget.create(-10, 24);
      expect(result.isFailure()).toBe(true);
    });

    it('fails when cost is zero', () => {
      const result = MissionBudget.create(0, 24);
      expect(result.isFailure()).toBe(true);
    });

    it('fails when duration is negative', () => {
      const result = MissionBudget.create(100, -1);
      expect(result.isFailure()).toBe(true);
    });

    it('fails when duration is zero', () => {
      const result = MissionBudget.create(100, 0);
      expect(result.isFailure()).toBe(true);
    });
  });

  describe('MissionBudget.isExceeded()', () => {
    it('returns false when within budget', () => {
      const budget = MissionBudget.create(100, 24).unwrap();
      expect(budget.isExceeded(50, 10)).toBe(false);
    });

    it('returns true when cost exceeds budget', () => {
      const budget = MissionBudget.create(100, 24).unwrap();
      expect(budget.isExceeded(101, 10)).toBe(true);
    });

    it('returns true when duration exceeds limit', () => {
      const budget = MissionBudget.create(100, 24).unwrap();
      expect(budget.isExceeded(50, 25)).toBe(true);
    });

    it('returns false at exact budget boundary', () => {
      const budget = MissionBudget.create(100, 24).unwrap();
      expect(budget.isExceeded(100, 24)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MISSION STATUS STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionStatus — State Machine', () => {
  describe('Valid transitions', () => {
    it('PENDING → PLANNING is valid', () => {
      expect(canTransition(MissionStatus.PENDING, MissionStatus.PLANNING)).toBe(true);
    });

    it('PENDING → FAILED is valid (immediate failure)', () => {
      expect(canTransition(MissionStatus.PENDING, MissionStatus.FAILED)).toBe(true);
    });

    it('PLANNING → EXECUTING is valid', () => {
      expect(canTransition(MissionStatus.PLANNING, MissionStatus.EXECUTING)).toBe(true);
    });

    it('EXECUTING → PAUSED is valid', () => {
      expect(canTransition(MissionStatus.EXECUTING, MissionStatus.PAUSED)).toBe(true);
    });

    it('EXECUTING → VERIFYING is valid', () => {
      expect(canTransition(MissionStatus.EXECUTING, MissionStatus.VERIFYING)).toBe(true);
    });

    it('EXECUTING → HUMAN_GATE is valid', () => {
      expect(canTransition(MissionStatus.EXECUTING, MissionStatus.HUMAN_GATE)).toBe(true);
    });

    it('PAUSED → EXECUTING is valid (resume)', () => {
      expect(canTransition(MissionStatus.PAUSED, MissionStatus.EXECUTING)).toBe(true);
    });

    it('HUMAN_GATE → EXECUTING is valid (resolved)', () => {
      expect(canTransition(MissionStatus.HUMAN_GATE, MissionStatus.EXECUTING)).toBe(true);
    });

    it('VERIFYING → COMPLETED is valid', () => {
      expect(canTransition(MissionStatus.VERIFYING, MissionStatus.COMPLETED)).toBe(true);
    });

    it('VERIFYING → EXECUTING is valid (re-execute after failed verification)', () => {
      expect(canTransition(MissionStatus.VERIFYING, MissionStatus.EXECUTING)).toBe(true);
    });
  });

  describe('Invalid transitions (must be rejected)', () => {
    it('PENDING → EXECUTING is invalid (skip PLANNING)', () => {
      expect(canTransition(MissionStatus.PENDING, MissionStatus.EXECUTING)).toBe(false);
    });

    it('PENDING → COMPLETED is invalid', () => {
      expect(canTransition(MissionStatus.PENDING, MissionStatus.COMPLETED)).toBe(false);
    });

    it('COMPLETED → EXECUTING is invalid (terminal state)', () => {
      expect(canTransition(MissionStatus.COMPLETED, MissionStatus.EXECUTING)).toBe(false);
    });

    it('COMPLETED → FAILED is invalid (terminal state)', () => {
      expect(canTransition(MissionStatus.COMPLETED, MissionStatus.FAILED)).toBe(false);
    });

    it('FAILED → EXECUTING is invalid (terminal state)', () => {
      expect(canTransition(MissionStatus.FAILED, MissionStatus.EXECUTING)).toBe(false);
    });

    it('FAILED → COMPLETED is invalid (terminal state)', () => {
      expect(canTransition(MissionStatus.FAILED, MissionStatus.COMPLETED)).toBe(false);
    });

    it('EXECUTING → PENDING is invalid (backwards)', () => {
      expect(canTransition(MissionStatus.EXECUTING, MissionStatus.PENDING)).toBe(false);
    });
  });

  it('terminal states have no valid outgoing transitions', () => {
    expect(MISSION_TRANSITIONS[MissionStatus.COMPLETED]).toHaveLength(0);
    expect(MISSION_TRANSITIONS[MissionStatus.FAILED]).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MISSION AGGREGATE
// ─────────────────────────────────────────────────────────────────────────────

describe('MissionAggregate — Full Lifecycle', () => {
  const validGoalText = 'Analyze our top 5 competitors and produce a detailed strategic response plan';
  const validOrgId = 'org-acme-001';

  // ── Factory ──────────────────────────────────────────────────────────────

  describe('MissionAggregate.create()', () => {
    it('creates a valid mission aggregate', () => {
      const result = MissionAggregate.create({
        orgId: validOrgId,
        goalText: validGoalText,
        maxCostUsd: 100,
        maxDurationHours: 24,
      });
      expect(result.isOk()).toBe(true);
    });

    it('assigns a UUID as id', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText, maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      expect(mission.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('starts in PENDING status', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText, maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      expect(mission.status).toBe(MissionStatus.PENDING);
    });

    it('starts at version 0', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText, maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      expect(mission.version).toBe(0);
    });

    it('emits MissionCreated domain event', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText, maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      expect(mission.domainEventCount).toBe(1);
      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.created');
    });

    it('fails with invalid goal text', () => {
      const result = MissionAggregate.create({
        orgId: validOrgId, goalText: 'short', maxCostUsd: 100, maxDurationHours: 24,
      });
      expect(result.isFailure()).toBe(true);
    });

    it('fails with invalid budget (zero cost)', () => {
      const result = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText, maxCostUsd: 0, maxDurationHours: 24,
      });
      expect(result.isFailure()).toBe(true);
    });

    it('supports optional correlationId', () => {
      const result = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
        correlationId: 'req-xyz-123',
      });
      expect(result.isOk()).toBe(true);
      const event = result.unwrap().peekDomainEvents()[0];
      expect(event?.correlationId).toBe('req-xyz-123');
    });
  });

  // ── State Transitions ─────────────────────────────────────────────────────

  describe('Mission lifecycle — happy path', () => {
    let mission!: MissionAggregate;
    const sampleDAG: MissionDAG = {
      nodes: [
        { taskId: 't1', title: 'Research', description: 'Research competitors', requiredCapabilities: ['research'], estimatedTokens: 5000, phaseId: 'p1' },
        { taskId: 't2', title: 'Analyze', description: 'Analyze data', requiredCapabilities: ['analysis'], estimatedTokens: 3000, phaseId: 'p1' },
        { taskId: 't3', title: 'Report', description: 'Write report', requiredCapabilities: ['writing'], estimatedTokens: 2000, phaseId: 'p2' },
      ],
      edges: [
        { from: 't1', to: 't2' },
        { from: 't2', to: 't3' },
      ],
      totalTasks: 3,
      phases: [
        { phaseId: 'p1', name: 'Phase 1', taskIds: ['t1', 't2'] },
        { phaseId: 'p2', name: 'Phase 2', taskIds: ['t3'] },
      ],
    };

    beforeEach(() => {
      mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      mission.pullDomainEvents(); // Clear creation events
    });

    it('PENDING → PLANNING via startPlanning()', () => {
      const result = mission.startPlanning();
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.PLANNING);
    });

    it('startPlanning() increments version', () => {
      mission.startPlanning();
      expect(mission.version).toBe(1);
    });

    it('startPlanning() emits MissionStarted event', () => {
      mission.startPlanning();
      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.started');
    });

    it('PLANNING → EXECUTING via attachDAG()', () => {
      mission.startPlanning();
      mission.pullDomainEvents();
      const result = mission.attachDAG(sampleDAG);
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.EXECUTING);
    });

    it('attachDAG() stores the DAG', () => {
      mission.startPlanning();
      mission.attachDAG(sampleDAG);
      expect(mission.dag).toBeDefined();
      expect(mission.dag?.totalTasks).toBe(3);
    });

    it('completeTask() tracks progress and emits events', () => {
      mission.startPlanning();
      mission.attachDAG(sampleDAG);
      mission.pullDomainEvents();

      const result = mission.completeTask('t1', 5.0);
      expect(result.isOk()).toBe(true);
      expect(mission.completedTaskCount).toBe(1);
      expect(mission.spentUsd).toBe(5.0);

      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.task-completed');
    });

    it('completing all tasks moves to VERIFYING', () => {
      mission.startPlanning();
      mission.attachDAG(sampleDAG);
      mission.pullDomainEvents();

      mission.completeTask('t1', 5.0);
      mission.completeTask('t2', 3.0);
      mission.completeTask('t3', 2.0); // Last task

      expect(mission.status).toBe(MissionStatus.VERIFYING);
    });

    it('complete() moves to COMPLETED and emits event', () => {
      mission.startPlanning();
      mission.attachDAG(sampleDAG);
      mission.completeTask('t1', 5.0);
      mission.completeTask('t2', 3.0);
      mission.completeTask('t3', 2.0);
      mission.pullDomainEvents();

      const result = mission.complete();
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.COMPLETED);

      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.completed');
    });
  });

  // ── Failure Paths ─────────────────────────────────────────────────────────

  describe('Mission lifecycle — failure paths', () => {
    let mission!: MissionAggregate;

    beforeEach(() => {
      mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      mission.pullDomainEvents();
    });

    it('cannot attach DAG before startPlanning()', () => {
      const dag: MissionDAG = {
        nodes: [{ taskId: 't1', title: 'T', description: 'D', requiredCapabilities: [], estimatedTokens: 100, phaseId: 'p1' }],
        edges: [], totalTasks: 1,
        phases: [{ phaseId: 'p1', name: 'P1', taskIds: ['t1'] }],
      };
      const result = mission.attachDAG(dag);
      expect(result.isFailure()).toBe(true);
    });

    it('cannot complete unknown task', () => {
      mission.startPlanning();
      mission.attachDAG({
        nodes: [{ taskId: 't1', title: 'T', description: 'D', requiredCapabilities: [], estimatedTokens: 100, phaseId: 'p1' }],
        edges: [], totalTasks: 1,
        phases: [{ phaseId: 'p1', name: 'P1', taskIds: ['t1'] }],
      });
      const result = mission.completeTask('nonexistent-task', 1.0);
      expect(result.isFailure()).toBe(true);
    });

    it('fail() moves to FAILED and emits event', () => {
      mission.startPlanning();
      mission.pullDomainEvents();

      const result = mission.fail('LLM service unavailable');
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.FAILED);

      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.failed');
    });

    it('cannot transition from FAILED (terminal)', () => {
      mission.fail('some reason');
      const result = mission.startPlanning();
      expect(result.isFailure()).toBe(true);
    });

    it('cannot transition from COMPLETED (terminal)', () => {
      mission.startPlanning();
      mission.attachDAG({
        nodes: [{ taskId: 't1', title: 'T', description: 'D', requiredCapabilities: [], estimatedTokens: 100, phaseId: 'p1' }],
        edges: [], totalTasks: 1,
        phases: [{ phaseId: 'p1', name: 'P1', taskIds: ['t1'] }],
      });
      mission.completeTask('t1', 1.0);
      mission.complete();
      // Now try another transition
      const result = mission.fail('too late');
      expect(result.isFailure()).toBe(true);
    });
  });

  // ── Human Gate ────────────────────────────────────────────────────────────

  describe('Human Gate', () => {
    let mission!: MissionAggregate;

    beforeEach(() => {
      mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      mission.startPlanning();
      mission.attachDAG({
        nodes: [{ taskId: 't1', title: 'T', description: 'D', requiredCapabilities: [], estimatedTokens: 100, phaseId: 'p1' }],
        edges: [], totalTasks: 1,
        phases: [{ phaseId: 'p1', name: 'P1', taskIds: ['t1'] }],
      });
      mission.pullDomainEvents();
    });

    it('openHumanGate() moves to HUMAN_GATE status', () => {
      const result = mission.openHumanGate('AMBIGUOUS_GOAL', 'The goal is unclear');
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.HUMAN_GATE);
    });

    it('openHumanGate() emits MissionHumanGateOpened event', () => {
      mission.openHumanGate('AMBIGUOUS_GOAL', 'The goal is unclear');
      const events = mission.peekDomainEvents();
      expect(events[0]?.eventType).toBe('hilux.core.mission.human-gate-opened');
    });

    it('resolveHumanGate() resumes execution', () => {
      mission.openHumanGate('AMBIGUOUS_GOAL', 'The goal is unclear');
      const events = mission.peekDomainEvents();
      const gateEvent = events[0] as any;
      mission.pullDomainEvents();

      const result = mission.resolveHumanGate(gateEvent.gateId);
      expect(result.isOk()).toBe(true);
      expect(mission.status).toBe(MissionStatus.EXECUTING);
    });

    it('cannot resolve a non-existent gate', () => {
      mission.openHumanGate('AMBIGUOUS_GOAL', 'The goal is unclear');
      const result = mission.resolveHumanGate('gate-does-not-exist');
      expect(result.isFailure()).toBe(true);
    });
  });

  // ── Event Sourcing integrity ──────────────────────────────────────────────

  describe('Event sourcing integrity', () => {
    it('each command increments version exactly once', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();

      expect(mission.version).toBe(0);
      mission.startPlanning();
      expect(mission.version).toBe(1);
      mission.attachDAG({
        nodes: [{ taskId: 't1', title: 'T', description: 'D', requiredCapabilities: [], estimatedTokens: 100, phaseId: 'p1' }],
        edges: [], totalTasks: 1,
        phases: [{ phaseId: 'p1', name: 'P1', taskIds: ['t1'] }],
      });
      expect(mission.version).toBe(2);
    });

    it('all events have correct aggregateId', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      mission.startPlanning();
      const events = mission.pullDomainEvents();
      for (const event of events) {
        expect(event.aggregateId).toBe(mission.id);
      }
    });

    it('all events have unique IDs', () => {
      const mission = MissionAggregate.create({
        orgId: validOrgId, goalText: validGoalText,
        maxCostUsd: 100, maxDurationHours: 24,
      }).unwrap();
      mission.startPlanning();
      const events = mission.pullDomainEvents();
      const ids = events.map((e: { eventId: string }) => e.eventId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
