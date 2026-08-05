/**
 * CreateMissionHandler — Command handler for mission creation.
 *
 * This is a USE CASE in Clean Architecture terms.
 * It orchestrates domain operations and infrastructure concerns
 * without containing any domain logic itself.
 *
 * Responsibilities:
 *   1. Create the MissionAggregate via its factory
 *   2. Persist it (write model)
 *   3. Dispatch domain events to the event bus
 *   4. Return a typed result to the API layer
 *
 * NEVER contains business rules — those live in the domain.
 * NEVER contains SQL — that lives in the infrastructure adapter.
 */
import { MissionAggregate } from '../../domain/aggregates/MissionAggregate.js';
import type { IMissionRepository } from '../../domain/repositories/IMissionRepository.js';
import type { EventBus } from '../../../../shared/events/EventBus.js';
import { Result } from '../../../../shared/kernel/Result.js';
import { DomainError } from '../../../../shared/errors/DomainError.js';

export interface CreateMissionCommand {
  orgId: string;
  goalText: string;
  maxCostUsd: number;
  maxDurationHours: number;
  requestedByUserId: string;
  correlationId?: string;
}

export interface CreateMissionResult {
  missionId: string;
  status: string;
  goalText: string;
}

export class CreateMissionHandler {
  constructor(
    private readonly missionRepository: IMissionRepository,
    private readonly eventBus: EventBus,
  ) {}

  async handle(
    command: CreateMissionCommand
  ): Promise<Result<CreateMissionResult, DomainError>> {
    // 1. Create aggregate (domain logic validates invariants)
    const missionResult = MissionAggregate.create({
      orgId: command.orgId,
      goalText: command.goalText,
      maxCostUsd: command.maxCostUsd,
      maxDurationHours: command.maxDurationHours,
      correlationId: command.correlationId,
    });

    if (missionResult.isFailure()) {
      return Result.fail(missionResult.error);
    }

    const mission = missionResult.value;

    // 2. Persist aggregate (infrastructure adapter)
    try {
      await this.missionRepository.save(mission);
    } catch (err) {
      return Result.fail(
        new DomainError(`Failed to persist mission: ${String(err)}`)
      );
    }

    // 3. Dispatch domain events (pulled from aggregate after save)
    const events = mission.pullDomainEvents();
    await this.eventBus.publishAll(events);

    return Result.ok({
      missionId: mission.id,
      status: mission.status,
      goalText: mission.goal.text,
    });
  }
}
