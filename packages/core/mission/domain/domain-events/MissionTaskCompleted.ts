import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';

export class MissionTaskCompleted extends DomainEvent {
  public readonly orgId: string;
  public readonly taskId: string;
  public readonly spentUsd: number;
  public readonly totalSpentUsd: number;
  public readonly completedCount: number;
  public readonly totalCount: number;

  constructor(payload: {
    aggregateId: string; orgId: string; taskId: string;
    spentUsd: number; totalSpentUsd: number; completedCount: number; totalCount: number;
  }) {
    super({ aggregateId: payload.aggregateId, aggregateType: 'Mission', eventType: 'hilux.core.mission.task-completed' });
    this.orgId = payload.orgId;
    this.taskId = payload.taskId;
    this.spentUsd = payload.spentUsd;
    this.totalSpentUsd = payload.totalSpentUsd;
    this.completedCount = payload.completedCount;
    this.totalCount = payload.totalCount;
  }

  protected getPayload() {
    return { orgId: this.orgId, taskId: this.taskId, spentUsd: this.spentUsd, totalSpentUsd: this.totalSpentUsd, completedCount: this.completedCount, totalCount: this.totalCount };
  }
}
