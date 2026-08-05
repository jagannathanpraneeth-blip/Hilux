/**
 * EventBus — Port (interface) for publishing domain events.
 *
 * This is a PORT in Hexagonal Architecture terms.
 * The domain and application layers only know about this interface.
 * The actual implementation (KafkaEventBus, InMemoryEventBus) lives
 * in the infrastructure layer and is injected via DI.
 *
 * WHY: This decouples our domain logic from Kafka entirely.
 * Tests use InMemoryEventBus. Production uses KafkaEventBus.
 * Switching message brokers is a one-line DI change.
 */
import { DomainEvent } from '../kernel/DomainEvent.js';

export interface EventBus {
  /**
   * Publish a single domain event.
   * Must be idempotent — duplicate events must be handled gracefully.
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publish multiple events atomically (within a transaction if supported).
   * Atomicity is critical for events pulled from a saved aggregate.
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}

/**
 * EventHandler — Interface for subscribing to domain events.
 */
export interface EventHandler<T extends DomainEvent> {
  eventType: string;
  handle(event: T): Promise<void>;
}
