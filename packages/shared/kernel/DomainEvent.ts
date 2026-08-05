/**
 * DomainEvent — Base class for all domain events.
 *
 * Domain events represent facts that happened in the domain.
 * They are named in past tense: MissionCreated, AgentSpawned, TaskCompleted.
 *
 * Events are the integration contract between bounded contexts.
 * No bounded context imports from another — they communicate only via events.
 *
 * IMMUTABILITY: Events are immutable once created. They are facts.
 * IDENTITY: Every event has a unique ID and timestamp.
 * ORDERING: sequence_number provides global ordering within an aggregate stream.
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly correlationId?: string;
  public readonly causationId?: string;

  constructor(props: {
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    correlationId?: string;
    causationId?: string;
  }) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
    this.eventType = props.eventType;
    this.aggregateId = props.aggregateId;
    this.aggregateType = props.aggregateType;
    this.correlationId = props.correlationId;
    this.causationId = props.causationId;
  }

  /**
   * Serialize event for storage / transport.
   * All subclass properties are included via the spread.
   */
  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt.toISOString(),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      correlationId: this.correlationId,
      causationId: this.causationId,
      // Subclass-specific payload
      payload: this.getPayload(),
    };
  }

  /**
   * Override in subclass to provide event-specific payload.
   */
  protected abstract getPayload(): Record<string, unknown>;
}
