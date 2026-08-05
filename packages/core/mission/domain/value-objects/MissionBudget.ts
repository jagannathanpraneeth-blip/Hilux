/**
 * MissionBudget — Value Object for mission resource constraints.
 *
 * A budget defines the maximum resources a mission may consume.
 * When a budget is exceeded, the mission is automatically paused
 * and a human gate is opened.
 *
 * Budget has two dimensions:
 *   1. Financial (USD cost of AI compute + API calls)
 *   2. Temporal (wall-clock hours to completion)
 *
 * WHY: Unconstrained AI execution can be expensive. Budget enforcement
 * is a safety primitive — not just a billing concern.
 */
import { ValueObject } from '../../../../shared/kernel/ValueObject.js';
import { Result } from '../../../../shared/kernel/Result.js';
import { DomainError } from '../../../../shared/errors/DomainError.js';

interface MissionBudgetProps {
  maxCostUsd: number;
  maxDurationHours: number;
  alertThresholdPercent: number; // Alert human at this % of budget used
}

export class MissionBudget extends ValueObject<MissionBudgetProps> {
  static readonly MIN_BUDGET_USD = 0.01;
  static readonly MAX_BUDGET_USD = 100_000;
  static readonly MIN_DURATION_HOURS = 0.1;
  static readonly MAX_DURATION_HOURS = 720; // 30 days

  private constructor(props: MissionBudgetProps) {
    super(props);
  }

  static create(
    maxCostUsd: number,
    maxDurationHours: number,
    alertThresholdPercent = 80
  ): Result<MissionBudget, DomainError> {
    if (maxCostUsd < MissionBudget.MIN_BUDGET_USD || maxCostUsd > MissionBudget.MAX_BUDGET_USD) {
      return Result.fail(
        new DomainError(
          `Budget must be between $${MissionBudget.MIN_BUDGET_USD} and $${MissionBudget.MAX_BUDGET_USD}. Got: $${maxCostUsd}`
        )
      );
    }

    if (
      maxDurationHours < MissionBudget.MIN_DURATION_HOURS ||
      maxDurationHours > MissionBudget.MAX_DURATION_HOURS
    ) {
      return Result.fail(
        new DomainError(
          `Duration must be between ${MissionBudget.MIN_DURATION_HOURS}h and ${MissionBudget.MAX_DURATION_HOURS}h. Got: ${maxDurationHours}h`
        )
      );
    }

    if (alertThresholdPercent < 0 || alertThresholdPercent > 100) {
      return Result.fail(new DomainError('Alert threshold must be between 0 and 100.'));
    }

    return Result.ok(
      new MissionBudget({ maxCostUsd, maxDurationHours, alertThresholdPercent })
    );
  }

  get maxCostUsd(): number { return this.props.maxCostUsd; }
  get maxDurationHours(): number { return this.props.maxDurationHours; }
  get alertThresholdPercent(): number { return this.props.alertThresholdPercent; }

  get alertThresholdUsd(): number {
    return this.props.maxCostUsd * (this.props.alertThresholdPercent / 100);
  }

  isExceeded(spentUsd: number, elapsedHours: number): boolean {
    return spentUsd > this.props.maxCostUsd || elapsedHours > this.props.maxDurationHours;
  }

  isApproachingLimit(spentUsd: number): boolean {
    return spentUsd >= this.alertThresholdUsd;
  }
}
