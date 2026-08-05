import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';

export class MissionStarted extends DomainEvent {
  public readonly orgId: string;
  constructor(payload: { aggregateId: string; orgId: string }) {
    super({ aggregateId: payload.aggregateId, aggregateType: 'Mission', eventType: 'hilux.core.mission.started' });
    this.orgId = payload.orgId;
  }
  protected getPayload() { return { orgId: this.orgId }; }
}
