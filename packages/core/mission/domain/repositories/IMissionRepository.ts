/**
 * IMissionRepository — Port (interface) for mission persistence.
 *
 * This interface is defined in the domain layer.
 * The implementation (PostgresMissionRepository) lives in infrastructure.
 *
 * WHY: The domain never imports from infrastructure. Ever.
 * This interface is the only coupling point.
 * Swapping PostgreSQL for another DB is a one-file change.
 *
 * The Repository pattern hides all persistence concerns from the domain:
 * - No SQL
 * - No ORMs
 * - No connection management
 * The domain only thinks about aggregate objects.
 */
import type { MissionAggregate } from '../aggregates/MissionAggregate.js';
import type { MissionStatus } from '../value-objects/MissionStatus.js';

export interface MissionFilter {
  orgId?: string;
  status?: MissionStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginatedMissions {
  missions: MissionAggregate[];
  total: number;
  hasMore: boolean;
}

export interface IMissionRepository {
  /**
   * Persist a new or updated mission aggregate.
   * Throws if optimistic locking conflict detected (version mismatch).
   */
  save(mission: MissionAggregate): Promise<void>;

  /**
   * Find by ID. Returns null if not found.
   */
  findById(id: string): Promise<MissionAggregate | null>;

  /**
   * Find missions matching filter criteria.
   */
  findMany(filter: MissionFilter, page: number, pageSize: number): Promise<PaginatedMissions>;

  /**
   * Find all active missions for an org (for Command Bridge).
   * Optimized read path — may use a read replica or projection.
   */
  findActive(orgId: string): Promise<MissionAggregate[]>;

  /**
   * Delete mission and all related data.
   * Soft-delete only — audit trail is preserved.
   */
  softDelete(id: string): Promise<void>;
}
