/**
 * DomainError — Base error class for all domain-layer errors.
 *
 * Domain errors represent violations of business rules.
 * They are first-class domain objects, not infrastructure exceptions.
 *
 * WHY typed errors: In an agent system with dozens of failure modes,
 * untyped Error objects lose critical context. Typed domain errors
 * enable precise error handling in command handlers and API layers.
 */
export class DomainError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code = 'DOMAIN_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(
      `Invalid state transition: ${from} → ${to}`,
      'INVALID_STATE_TRANSITION',
      { from, to }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class BudgetExceededError extends DomainError {
  constructor(spent: number, max: number) {
    super(
      `Mission budget exceeded: $${spent.toFixed(4)} of $${max}`,
      'BUDGET_EXCEEDED',
      { spent, max }
    );
    this.name = 'BudgetExceededError';
  }
}

export class AgentCapabilityMismatchError extends DomainError {
  constructor(required: string[], available: string[]) {
    super(
      `Agent lacks required capabilities: ${required.join(', ')}`,
      'CAPABILITY_MISMATCH',
      { required, available }
    );
    this.name = 'AgentCapabilityMismatchError';
  }
}

export class CycleDetectedError extends DomainError {
  constructor() {
    super('Mission DAG contains a cycle — invalid mission structure', 'DAG_CYCLE_DETECTED');
    this.name = 'CycleDetectedError';
  }
}
