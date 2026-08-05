/**
 * MissionCreated — Domain event emitted when a new mission is created.
 *
 * This event is the trigger for the Planner Agent.
 * The event bus routes it to the Planning Service, which starts
 * goal decomposition into a Mission DAG.
 *
 * WHY events carry all necessary data: Downstream consumers should
 * not need to query back to the Mission service for the data they
 * need to react. Events are self-contained facts.
 */
import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';

interface MissionCreatedPayload {
  aggregateId: string;
  orgId: string;
  goalText: string;
  budgetUsd: number;
  durationHours: number;
  correlationId?: string;
}

export class MissionCreated extends DomainEvent {
  public readonly orgId: string;
  public readonly goalText: string;
  public readonly budgetUsd: number;
  public readonly durationHours: number;

  constructor(payload: MissionCreatedPayload) {
    super({
      aggregateId: payload.aggregateId,
      aggregateType: 'Mission',
      eventType: 'hilux.core.mission.created',
      correlationId: payload.correlationId,
    });
    this.orgId = payload.orgId;
    this.goalText = payload.goalText;
    this.budgetUsd = payload.budgetUsd;
    this.durationHours = payload.durationHours;
  }

  protected getPayload(): Record<string, unknown> {
    return {
      orgId: this.orgId,
      goalText: this.goalText,
      budgetUsd: this.budgetUsd,
      durationHours: this.durationHours,
    };
  }
}
