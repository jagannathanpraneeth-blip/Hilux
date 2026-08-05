import { DomainEvent } from '../../../../shared/kernel/DomainEvent.js';
export class MissionHumanGateOpened extends DomainEvent {
  public readonly orgId: string; public readonly gateId: string;
  public readonly reason: string; public readonly context: string;
  constructor(p: { aggregateId: string; orgId: string; gateId: string; reason: string; context: string }) {
    super({ aggregateId: p.aggregateId, aggregateType: 'Mission', eventType: 'hilux.core.mission.human-gate-opened' });
    this.orgId = p.orgId; this.gateId = p.gateId; this.reason = p.reason; this.context = p.context;
  }
  protected getPayload() { return { orgId: this.orgId, gateId: this.gateId, reason: this.reason, context: this.context }; }
}
