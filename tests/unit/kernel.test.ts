/**
 * ─── KERNEL TESTS ────────────────────────────────────────────────────────────
 * Tests for the foundational DDD building blocks:
 *   - Result<T, E>  (railway-oriented error handling)
 *   - Entity        (identity-based equality)
 *   - ValueObject   (value-based equality, immutability)
 *   - DomainEvent   (event sourcing base)
 *   - AggregateRoot (event collection and flushing)
 */

import { describe, it, expect } from 'vitest';

// We import directly from the TS source files (vitest/esbuild transpiles inline)
import { Result, Ok, Fail } from '../../packages/shared/kernel/Result.js';
import { Entity } from '../../packages/shared/kernel/Entity.js';
import { ValueObject } from '../../packages/shared/kernel/ValueObject.js';
import { DomainEvent } from '../../packages/shared/kernel/DomainEvent.js';
import { AggregateRoot } from '../../packages/shared/kernel/AggregateRoot.js';

// ─────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

class TestEntity extends Entity<string> {
  constructor(id: string) { super(id); }
}

interface MoneyProps { amount: number; currency: string }
class Money extends ValueObject<MoneyProps> {
  constructor(amount: number, currency: string) { super({ amount, currency }); }
  get amount() { return this.props.amount; }
  get currency() { return this.props.currency; }
}

class OrderCreatedEvent extends DomainEvent {
  public readonly amount: number;
  constructor(aggregateId: string, amount: number) {
    super({ aggregateId, aggregateType: 'Order', eventType: 'order.created' });
    this.amount = amount;
  }
  protected getPayload() { return { amount: this.amount }; }
}

class TestAggregate extends AggregateRoot<string> {
  private _name: string;
  constructor(id: string, name: string) {
    super(id);
    this._name = name;
  }
  rename(newName: string) {
    this._name = newName;
    this.addDomainEvent(
      new OrderCreatedEvent(this.id, 100)
    );
  }
  get name() { return this._name; }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT<T,E> TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Result<T,E> — Railway-Oriented Error Handling', () => {
  describe('Result.ok()', () => {
    it('creates a successful result with a value', () => {
      const result = Result.ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isFailure()).toBe(false);
      expect(result instanceof Ok).toBe(true);
    });

    it('holds the correct value', () => {
      const result = Result.ok('hello');
      expect(result.unwrap()).toBe('hello');
    });

    it('maps over Ok value', () => {
      const result = Result.ok(10).map(x => x * 2);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(20);
    });

    it('flatMaps over Ok value', () => {
      const result = Result.ok(10).flatMap(x => Result.ok(x + 5));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(15);
    });

    it('getOrElse returns the value for Ok', () => {
      expect(Result.ok(99).getOrElse(0)).toBe(99);
    });

    it('creates Ok with void/undefined value', () => {
      const result = Result.ok<void>(undefined as void);
      expect(result.isOk()).toBe(true);
    });

    it('creates Ok with complex object', () => {
      const obj = { id: '1', name: 'test', nested: { value: 42 } };
      const result = Result.ok(obj);
      expect(result.unwrap()).toEqual(obj);
    });
  });

  describe('Result.fail()', () => {
    it('creates a failed result', () => {
      const result = Result.fail(new Error('something went wrong'));
      expect(result.isOk()).toBe(false);
      expect(result.isFailure()).toBe(true);
      expect(result instanceof Fail).toBe(true);
    });

    it('holds the error', () => {
      const err = new Error('test error');
      const result = Result.fail(err);
      expect(result.unwrapError()).toBe(err);
    });

    it('map on Fail propagates the error (no side effect)', () => {
      let sideEffect = false;
      const result = Result.fail<number>(new Error('fail')).map(x => {
        sideEffect = true;
        return x * 2;
      });
      expect(sideEffect).toBe(false);
      expect(result.isFailure()).toBe(true);
    });

    it('flatMap on Fail propagates the error', () => {
      const result = Result.fail<number>(new Error('fail')).flatMap(x =>
        Result.ok(x + 1)
      );
      expect(result.isFailure()).toBe(true);
    });

    it('getOrElse returns fallback for Fail', () => {
      const result = Result.fail<number>(new Error('fail'));
      expect(result.getOrElse(42)).toBe(42);
    });

    it('supports typed custom errors', () => {
      class DomainError extends Error {
        constructor(public readonly code: string, message: string) {
          super(message);
        }
      }
      const result = Result.fail<never, DomainError>(new DomainError('INVALID_GOAL', 'Goal is too short'));
      expect(result.unwrapError().code).toBe('INVALID_GOAL');
    });
  });

  describe('Result.all()', () => {
    it('returns Ok with all values when all succeed', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const combined = Result.all(results);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([1, 2, 3]);
    });

    it('returns Fail on first failure', () => {
      const err = new Error('second failed');
      const results = [Result.ok(1), Result.fail<number>(err), Result.ok(3)];
      const combined = Result.all(results);
      expect(combined.isFailure()).toBe(true);
      expect(combined.unwrapError()).toBe(err);
    });

    it('returns Ok for empty array', () => {
      const combined = Result.all<number, Error>([]);
      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([]);
    });

    it('chaining: pipeline of operations', () => {
      const parseAge = (s: string): Result<number, Error> => {
        const n = parseInt(s);
        return isNaN(n) ? Result.fail(new Error('Not a number')) : Result.ok(n);
      };
      const validateAge = (n: number): Result<number, Error> =>
        n >= 0 && n <= 150 ? Result.ok(n) : Result.fail(new Error('Age out of range'));

      // Valid pipeline
      const valid = parseAge('25').flatMap(validateAge);
      expect(valid.isOk()).toBe(true);
      expect(valid.unwrap()).toBe(25);

      // Invalid input
      const invalid = parseAge('abc').flatMap(validateAge);
      expect(invalid.isFailure()).toBe(true);

      // Out of range
      const outOfRange = parseAge('200').flatMap(validateAge);
      expect(outOfRange.isFailure()).toBe(true);
      expect(outOfRange.unwrapError().message).toBe('Age out of range');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Entity — Identity-Based Equality', () => {
  it('two entities with the same ID are equal', () => {
    const a = new TestEntity('entity-123');
    const b = new TestEntity('entity-123');
    expect(a.equals(b)).toBe(true);
  });

  it('two entities with different IDs are not equal', () => {
    const a = new TestEntity('entity-1');
    const b = new TestEntity('entity-2');
    expect(a.equals(b)).toBe(false);
  });

  it('entity is equal to itself', () => {
    const a = new TestEntity('entity-abc');
    expect(a.equals(a)).toBe(true);
  });

  it('exposes id correctly', () => {
    const entity = new TestEntity('my-id-999');
    expect(entity.id).toBe('my-id-999');
  });

  it('entities of different classes with same ID are NOT equal (type safety)', () => {
    class OtherEntity extends Entity<string> {
      constructor(id: string) { super(id); }
    }
    const a = new TestEntity('same-id');
    const b = new OtherEntity('same-id');
    // equals() returns false because instanceof differs
    expect(a.equals(b as unknown as TestEntity)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VALUE OBJECT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ValueObject — Value-Based Equality & Immutability', () => {
  it('two value objects with same props are equal', () => {
    const a = new Money(100, 'USD');
    const b = new Money(100, 'USD');
    expect(a.equals(b)).toBe(true);
  });

  it('value objects with different amounts are not equal', () => {
    const a = new Money(100, 'USD');
    const b = new Money(200, 'USD');
    expect(a.equals(b)).toBe(false);
  });

  it('value objects with different currencies are not equal', () => {
    const a = new Money(100, 'USD');
    const b = new Money(100, 'EUR');
    expect(a.equals(b)).toBe(false);
  });

  it('props are frozen (immutable)', () => {
    const money = new Money(100, 'USD');
    expect(() => {
      // @ts-ignore intentional mutation attempt
      (money.props as any).amount = 999;
    }).toThrow();
  });

  it('equals returns false for non-ValueObject', () => {
    const money = new Money(100, 'USD');
    expect(money.equals({} as any)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN EVENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('DomainEvent — Event Sourcing Base', () => {
  it('creates event with required fields', () => {
    const event = new OrderCreatedEvent('order-1', 250);
    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe('order.created');
    expect(event.aggregateId).toBe('order-1');
    expect(event.aggregateType).toBe('Order');
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('every event gets a unique ID', () => {
    const e1 = new OrderCreatedEvent('order-1', 100);
    const e2 = new OrderCreatedEvent('order-1', 100);
    expect(e1.eventId).not.toBe(e2.eventId);
  });

  it('serializes to JSON correctly', () => {
    const event = new OrderCreatedEvent('order-123', 500);
    const json = event.toJSON();
    expect(json).toHaveProperty('eventId');
    expect(json).toHaveProperty('eventType', 'order.created');
    expect(json).toHaveProperty('aggregateId', 'order-123');
    expect(json).toHaveProperty('payload');
    expect((json['payload'] as any).amount).toBe(500);
  });

  it('supports optional correlationId', () => {
    class CorrelatedEvent extends DomainEvent {
      constructor() {
        super({
          aggregateId: 'a1', aggregateType: 'A', eventType: 'a.done',
          correlationId: 'corr-xyz',
        });
      }
      protected getPayload() { return {}; }
    }
    const e = new CorrelatedEvent();
    expect(e.correlationId).toBe('corr-xyz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE ROOT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('AggregateRoot — Event Collection & Flushing', () => {
  it('starts with no domain events', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    expect(agg.domainEventCount).toBe(0);
    expect(agg.peekDomainEvents()).toHaveLength(0);
  });

  it('records events when commands are executed', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('SuperWidget');
    expect(agg.domainEventCount).toBe(1);
  });

  it('accumulates multiple events', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('Name1');
    agg.rename('Name2');
    agg.rename('Name3');
    expect(agg.domainEventCount).toBe(3);
  });

  it('pullDomainEvents returns all events and clears the list', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('NewName');
    const events = agg.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(agg.domainEventCount).toBe(0); // cleared
  });

  it('pulled events are correct type', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('Test');
    const events = agg.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    expect((events[0] as OrderCreatedEvent).amount).toBe(100);
  });

  it('peekDomainEvents does NOT clear the list', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('Test');
    agg.peekDomainEvents();
    expect(agg.domainEventCount).toBe(1); // still there
  });

  it('pulling twice gives empty second time', () => {
    const agg = new TestAggregate('agg-1', 'Widget');
    agg.rename('Test');
    const first = agg.pullDomainEvents();
    const second = agg.pullDomainEvents();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});
