/**
 * MissionAggregate — The core consistency boundary for mission execution.
 *
 * This aggregate owns the lifecycle of a Mission from goal input to completion.
 * All state changes go through this aggregate. No external code mutates
 * mission state directly — only via commands that produce domain events.
 *
 * CONSISTENCY: The aggregate is the unit of transactional consistency.
 * Everything within a MissionAggregate is always consistent.
 * Cross-aggregate consistency is achieved via eventual consistency (events).
 *
 * OPTIMISTIC LOCKING: version field prevents concurrent write conflicts.
 */
import { AggregateRoot } from '../../../../shared/kernel/AggregateRoot.js';
import { Result } from '../../../../shared/kernel/Result.js';
import { DomainError } from '../../../../shared/errors/DomainError.js';
import { Goal } from '../value-objects/Goal.js';
import { MissionBudget } from '../value-objects/MissionBudget.js';
import { MissionStatus, canTransition } from '../value-objects/MissionStatus.js';
import { MissionCreated } from '../domain-events/MissionCreated.js';
import { MissionStarted } from '../domain-events/MissionStarted.js';
import { MissionTaskCompleted } from '../domain-events/MissionTaskCompleted.js';
import { MissionPaused } from '../domain-events/MissionPaused.js';
import { MissionFailed } from '../domain-events/MissionFailed.js';
import { MissionCompleted } from '../domain-events/MissionCompleted.js';
import { MissionHumanGateOpened } from '../domain-events/MissionHumanGateOpened.js';

export interface MissionDAG {
  nodes: TaskNode[];
  edges: TaskEdge[];
  totalTasks: number;
  phases: Phase[];
}

export interface TaskNode {
  taskId: string;
  title: string;
  description: string;
  requiredCapabilities: string[];
  estimatedTokens: number;
  phaseId: string;
}

export interface TaskEdge {
  from: string;  // taskId
  to: string;    // taskId
}

export interface Phase {
  phaseId: string;
  name: string;
  taskIds: string[];
}

export interface HumanGate {
  gateId: string;
  reason: string;
  context: string;
  blockedAt: Date;
  resolvedAt?: Date;
}

interface MissionAggregateProps {
  id: string;
  orgId: string;
  goal: Goal;
  budget: MissionBudget;
  status: MissionStatus;
  dag?: MissionDAG;
  workforceId?: string;
  completedTaskIds: Set<string>;
  spentUsd: number;
  humanGates: HumanGate[];
  version: number;
  startedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
}

export class MissionAggregate extends AggregateRoot<string> {
  private props: MissionAggregateProps;

  private constructor(props: MissionAggregateProps) {
    super(props.id);
    this.props = props;
  }

  // ─────────────────────────────────────────────
  // FACTORY
  // ─────────────────────────────────────────────

  static create(input: {
    orgId: string;
    goalText: string;
    maxCostUsd: number;
    maxDurationHours: number;
    correlationId?: string;
  }): Result<MissionAggregate, DomainError> {
    const goalResult = Goal.create(input.goalText);
    if (goalResult.isFailure()) return Result.fail(goalResult.error);

    const budgetResult = MissionBudget.create(input.maxCostUsd, input.maxDurationHours);
    if (budgetResult.isFailure()) return Result.fail(budgetResult.error);

    const id = crypto.randomUUID();
    const mission = new MissionAggregate({
      id,
      orgId: input.orgId,
      goal: goalResult.value,
      budget: budgetResult.value,
      status: MissionStatus.PENDING,
      completedTaskIds: new Set(),
      spentUsd: 0,
      humanGates: [],
      version: 0,
    });

    mission.addDomainEvent(
      new MissionCreated({
        aggregateId: id,
        orgId: input.orgId,
        goalText: goalResult.value.text,
        budgetUsd: budgetResult.value.maxCostUsd,
        durationHours: budgetResult.value.maxDurationHours,
        correlationId: input.correlationId,
      })
    );

    return Result.ok(mission);
  }

  // ─────────────────────────────────────────────
  // COMMANDS
  // ─────────────────────────────────────────────

  startPlanning(): Result<void, DomainError> {
    return this.transition(MissionStatus.PLANNING, () => {
      this.addDomainEvent(
        new MissionStarted({ aggregateId: this.id, orgId: this.props.orgId })
      );
      this.props.startedAt = new Date();
    });
  }

  attachDAG(dag: MissionDAG): Result<void, DomainError> {
    if (this.props.status !== MissionStatus.PLANNING) {
      return Result.fail(
        new DomainError(`Cannot attach DAG in status: ${this.props.status}`)
      );
    }
    this.props.dag = dag;
    return this.transition(MissionStatus.EXECUTING, () => {});
  }

  completeTask(taskId: string, spentUsd: number): Result<void, DomainError> {
    if (this.props.status !== MissionStatus.EXECUTING) {
      return Result.fail(
        new DomainError(`Cannot complete task in status: ${this.props.status}`)
      );
    }

    if (!this.props.dag?.nodes.find(n => n.taskId === taskId)) {
      return Result.fail(new DomainError(`Task ${taskId} not found in mission DAG`));
    }

    this.props.completedTaskIds.add(taskId);
    this.props.spentUsd += spentUsd;

    this.addDomainEvent(
      new MissionTaskCompleted({
        aggregateId: this.id,
        orgId: this.props.orgId,
        taskId,
        spentUsd,
        totalSpentUsd: this.props.spentUsd,
        completedCount: this.props.completedTaskIds.size,
        totalCount: this.props.dag.totalTasks,
      })
    );

    // Budget enforcement
    if (this.props.budget.isExceeded(this.props.spentUsd, this.elapsedHours)) {
      return this.openHumanGate(
        'BUDGET_EXCEEDED',
        `Mission exceeded budget: $${this.props.spentUsd.toFixed(4)} of $${this.props.budget.maxCostUsd}`
      );
    }

    // Check if all tasks complete → move to verifying
    if (this.props.completedTaskIds.size === this.props.dag.totalTasks) {
      return this.transition(MissionStatus.VERIFYING, () => {});
    }

    return Result.ok();
  }

  pause(reason: string): Result<void, DomainError> {
    return this.transition(MissionStatus.PAUSED, () => {
      this.addDomainEvent(
        new MissionPaused({ aggregateId: this.id, orgId: this.props.orgId, reason })
      );
    });
  }

  fail(reason: string): Result<void, DomainError> {
    return this.transition(MissionStatus.FAILED, () => {
      this.props.failureReason = reason;
      this.props.completedAt = new Date();
      this.addDomainEvent(
        new MissionFailed({ aggregateId: this.id, orgId: this.props.orgId, reason })
      );
    });
  }

  complete(): Result<void, DomainError> {
    return this.transition(MissionStatus.COMPLETED, () => {
      this.props.completedAt = new Date();
      this.addDomainEvent(
        new MissionCompleted({
          aggregateId: this.id,
          orgId: this.props.orgId,
          totalSpentUsd: this.props.spentUsd,
          durationHours: this.elapsedHours,
        })
      );
    });
  }

  openHumanGate(reason: string, context: string): Result<void, DomainError> {
    const gate: HumanGate = {
      gateId: crypto.randomUUID(),
      reason,
      context,
      blockedAt: new Date(),
    };

    this.props.humanGates.push(gate);

    return this.transition(MissionStatus.HUMAN_GATE, () => {
      this.addDomainEvent(
        new MissionHumanGateOpened({
          aggregateId: this.id,
          orgId: this.props.orgId,
          gateId: gate.gateId,
          reason,
          context,
        })
      );
    });
  }

  resolveHumanGate(gateId: string): Result<void, DomainError> {
    const gate = this.props.humanGates.find(g => g.gateId === gateId);
    if (!gate) return Result.fail(new DomainError(`Human gate ${gateId} not found`));
    if (gate.resolvedAt) return Result.fail(new DomainError(`Human gate ${gateId} already resolved`));

    gate.resolvedAt = new Date();
    return this.transition(MissionStatus.EXECUTING, () => {});
  }

  // ─────────────────────────────────────────────
  // GETTERS (read-only projections)
  // ─────────────────────────────────────────────

  get orgId(): string { return this.props.orgId; }
  get goal(): Goal { return this.props.goal; }
  get budget(): MissionBudget { return this.props.budget; }
  get status(): MissionStatus { return this.props.status; }
  get dag(): MissionDAG | undefined { return this.props.dag; }
  get spentUsd(): number { return this.props.spentUsd; }
  get version(): number { return this.props.version; }

  get elapsedHours(): number {
    if (!this.props.startedAt) return 0;
    const ms = Date.now() - this.props.startedAt.getTime();
    return ms / 3_600_000;
  }

  get completedTaskCount(): number { return this.props.completedTaskIds.size; }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private transition(
    to: MissionStatus,
    action: () => void
  ): Result<void, DomainError> {
    if (!canTransition(this.props.status, to)) {
      return Result.fail(
        new DomainError(
          `Invalid state transition: ${this.props.status} → ${to}`
        )
      );
    }
    this.props.status = to;
    this.props.version++;
    action();
    return Result.ok();
  }
}
