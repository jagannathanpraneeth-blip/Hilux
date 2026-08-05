import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';
export class MissionFailed extends DomainEvent {
  public readonly orgId: string; public readonly reason: string;
  constructor(p: { aggregateId: string; orgId: string; reason: string }) {
    super({ aggregateId: p.aggregateId, aggregateType: 'Mission', eventType: 'hilux.core.mission.failed' });
    this.orgId = p.orgId; this.reason = p.reason;
  }
  protected getPayload() { return { orgId: this.orgId, reason: this.reason }; }
}

