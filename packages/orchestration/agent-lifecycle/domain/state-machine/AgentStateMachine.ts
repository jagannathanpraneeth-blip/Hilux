/**
 * AgentStateMachine — XState-based state machine for agent lifecycle.
 *
 * WHY XState: Formal state machines prevent impossible state bugs.
 * In a system where agents can fail in 20+ ways, an informal FSM
 * using if/else chains always has missing state transitions.
 * XState makes all transitions explicit and visualizable.
 *
 * State transitions map directly to agent lifecycle events that
 * are published to Kafka and rendered in the Lens UI.
 */

export type AgentState =
  | 'idle'
  | 'loading_context'
  | 'planning'
  | 'executing'
  | 'tool_waiting'
  | 'reflecting'
  | 'self_correcting'
  | 'retrying'
  | 'submitting'
  | 'awaiting_human'
  | 'error'
  | 'terminated';

export type AgentEvent =
  | { type: 'ASSIGN_TASK'; taskId: string }
  | { type: 'CONTEXT_LOADED' }
  | { type: 'CONTEXT_FAILED'; reason: string }
  | { type: 'PLAN_READY' }
  | { type: 'PLAN_AMBIGUOUS'; context: string }
  | { type: 'PLAN_FAILED'; reason: string }
  | { type: 'TOOL_CALL'; toolName: string }
  | { type: 'TOOL_SUCCESS'; result: unknown }
  | { type: 'TOOL_FAILURE'; reason: string }
  | { type: 'REFLECTION_TRIGGERED' }
  | { type: 'REFLECTION_PASS' }
  | { type: 'REFLECTION_FAIL'; issues: string[] }
  | { type: 'CORRECTION_APPLIED' }
  | { type: 'CORRECTION_FAILED'; reason: string }
  | { type: 'OUTPUT_READY'; output: unknown }
  | { type: 'RETRY' }
  | { type: 'MAX_RETRIES_EXCEEDED' }
  | { type: 'VERIFIED' }
  | { type: 'VERIFICATION_FAILED'; reasons: string[] }
  | { type: 'ESCALATED'; reason: string }
  | { type: 'HUMAN_RESOLVED'; resolution: unknown }
  | { type: 'HUMAN_ABORTED'; reason: string }
  | { type: 'TERMINATE' };

export const AGENT_TRANSITIONS: Record<AgentState, Partial<Record<AgentEvent['type'], AgentState>>> = {
  idle: {
    ASSIGN_TASK: 'loading_context',
    TERMINATE: 'terminated',
  },
  loading_context: {
    CONTEXT_LOADED: 'planning',
    CONTEXT_FAILED: 'error',
  },
  planning: {
    PLAN_READY: 'executing',
    PLAN_AMBIGUOUS: 'awaiting_human',
    PLAN_FAILED: 'error',
  },
  executing: {
    TOOL_CALL: 'tool_waiting',
    REFLECTION_TRIGGERED: 'reflecting',
    OUTPUT_READY: 'submitting',
    TERMINATE: 'terminated',
  },
  tool_waiting: {
    TOOL_SUCCESS: 'executing',
    TOOL_FAILURE: 'retrying',
  },
  reflecting: {
    REFLECTION_PASS: 'executing',
    REFLECTION_FAIL: 'self_correcting',
  },
  self_correcting: {
    CORRECTION_APPLIED: 'executing',
    CORRECTION_FAILED: 'awaiting_human',
  },
  retrying: {
    RETRY: 'tool_waiting',
    MAX_RETRIES_EXCEEDED: 'awaiting_human',
  },
  submitting: {
    VERIFIED: 'idle',
    VERIFICATION_FAILED: 'self_correcting',
    ESCALATED: 'awaiting_human',
  },
  awaiting_human: {
    HUMAN_RESOLVED: 'executing',
    HUMAN_ABORTED: 'terminated',
  },
  error: {},    // Terminal
  terminated: {}, // Terminal
};

export class AgentStateMachineRuntime {
  private currentState: AgentState;
  private history: Array<{ state: AgentState; event: AgentEvent['type']; timestamp: Date }> = [];

  constructor(initialState: AgentState = 'idle') {
    this.currentState = initialState;
  }

  get state(): AgentState {
    return this.currentState;
  }

  transition(event: AgentEvent): { success: boolean; newState: AgentState; error?: string } {
    const transitions = AGENT_TRANSITIONS[this.currentState];
    const nextState = transitions[event.type as AgentEvent['type']];

    if (!nextState) {
      return {
        success: false,
        newState: this.currentState,
        error: `No transition from ${this.currentState} on event ${event.type}`,
      };
    }

    this.history.push({
      state: this.currentState,
      event: event.type,
      timestamp: new Date(),
    });

    this.currentState = nextState;
    return { success: true, newState: nextState };
  }

  isTerminal(): boolean {
    return this.currentState === 'error' || this.currentState === 'terminated';
  }

  getHistory() {
    return [...this.history];
  }

  snapshot(): { state: AgentState; history: typeof this.history } {
    return { state: this.currentState, history: this.getHistory() };
  }
}
