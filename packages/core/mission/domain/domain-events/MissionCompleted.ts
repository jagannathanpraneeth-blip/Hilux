import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';
export class MissionCompleted extends DomainEvent {
  public readonly orgId: string; public readonly totalSpentUsd: number; public readonly durationHours: number;
  constructor(p: { aggregateId: string; orgId: string; totalSpentUsd: number; durationHours: number }) {
    super({ aggregateId: p.aggregateId, aggregateType: 'Mission', eventType: 'hilux.core.mission.completed' });
    this.orgId = p.orgId; this.totalSpentUsd = p.totalSpentUsd; this.durationHours = p.durationHours;
  }
  protected getPayload() { return { orgId: this.orgId, totalSpentUsd: this.totalSpentUsd, durationHours: this.durationHours }; }
}
