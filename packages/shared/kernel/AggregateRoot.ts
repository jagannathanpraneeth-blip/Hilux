/**
 * AggregateRoot — Base class for all DDD aggregates.
 *
 * An aggregate is a cluster of domain objects treated as a single unit
 * for data changes. The AggregateRoot is the only member that outside
 * objects hold references to.
 *
 * Aggregates collect domain events and flush them when saved.
 * This is the foundation of our event-sourced architecture.
 */

import { DomainEvent } from './DomainEvent.js';
import { Entity } from './Entity.js';

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  /**
   * Add a domain event to be dispatched when this aggregate is persisted.
   * Events are dispatched by the repository after successful save.
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Returns all pending domain events and clears the list.
   * Called by the repository after successful persistence.
   */
  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  /**
   * Returns pending event count (for testing/debugging).
   */
  public get domainEventCount(): number {
    return this._domainEvents.length;
  }

  /**
   * Peek at events without clearing (for testing only).
   */
  public peekDomainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }
}
