/**
 * MissionStatus — State machine enumeration for Mission lifecycle.
 *
 * Valid transitions (enforced by MissionAggregate):
 *
 *  PENDING ──────► PLANNING ──────► EXECUTING ──────► VERIFYING ──────► COMPLETED
 *                                       │                   │
 *                                    PAUSED            HUMAN_GATE
 *                                       │                   │
 *                                    EXECUTING ◄────────────┘
 *                                       │
 *                                    FAILED
 *
 * CRITICAL: Invalid transitions throw DomainErrors.
 * This prevents the system from ever entering an undefined state.
 */
export enum MissionStatus {
  PENDING = 'PENDING',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  PAUSED = 'PAUSED',
  VERIFYING = 'VERIFYING',
  HUMAN_GATE = 'HUMAN_GATE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  [MissionStatus.PENDING]: [MissionStatus.PLANNING, MissionStatus.FAILED],
  [MissionStatus.PLANNING]: [MissionStatus.EXECUTING, MissionStatus.FAILED],
  [MissionStatus.EXECUTING]: [
    MissionStatus.PAUSED,
    MissionStatus.VERIFYING,
    MissionStatus.HUMAN_GATE,
    MissionStatus.FAILED,
  ],
  [MissionStatus.PAUSED]: [MissionStatus.EXECUTING, MissionStatus.FAILED],
  [MissionStatus.VERIFYING]: [
    MissionStatus.COMPLETED,
    MissionStatus.EXECUTING, // Re-execute after failed verification
    MissionStatus.HUMAN_GATE,
    MissionStatus.FAILED,
  ],
  [MissionStatus.HUMAN_GATE]: [MissionStatus.EXECUTING, MissionStatus.FAILED],
  [MissionStatus.COMPLETED]: [], // Terminal
  [MissionStatus.FAILED]: [],    // Terminal
};

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from]?.includes(to) ?? false;
}
