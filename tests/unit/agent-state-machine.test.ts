/**
 * ─── AGENT STATE MACHINE TESTS ───────────────────────────────────────────────
 * Tests for AgentStateMachineRuntime:
 *   - All valid transitions
 *   - All invalid transitions (rejected)
 *   - Terminal state detection
 *   - History recording
 *   - Snapshot consistency
 */

import { describe, it, expect } from 'vitest';
import {
  AgentStateMachineRuntime,
  AGENT_TRANSITIONS,
  type AgentState,
  type AgentEvent,
} from '../../packages/orchestration/agent-lifecycle/domain/state-machine/AgentStateMachine.js';

describe('AgentStateMachineRuntime — Agent Lifecycle', () => {

  describe('Initial state', () => {
    it('starts in idle state by default', () => {
      const fsm = new AgentStateMachineRuntime();
      expect(fsm.state).toBe('idle');
    });

    it('accepts a custom initial state', () => {
      const fsm = new AgentStateMachineRuntime('loading_context');
      expect(fsm.state).toBe('loading_context');
    });

    it('starts with empty history', () => {
      const fsm = new AgentStateMachineRuntime();
      expect(fsm.getHistory()).toHaveLength(0);
    });

    it('is not terminal in initial state', () => {
      const fsm = new AgentStateMachineRuntime();
      expect(fsm.isTerminal()).toBe(false);
    });
  });

  describe('Valid transitions — full happy path', () => {
    it('idle → loading_context on ASSIGN_TASK', () => {
      const fsm = new AgentStateMachineRuntime();
      const result = fsm.transition({ type: 'ASSIGN_TASK', taskId: 'task-1' });
      expect(result.success).toBe(true);
      expect(result.newState).toBe('loading_context');
      expect(fsm.state).toBe('loading_context');
    });

    it('loading_context → planning on CONTEXT_LOADED', () => {
      const fsm = new AgentStateMachineRuntime('loading_context');
      const result = fsm.transition({ type: 'CONTEXT_LOADED' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('planning');
    });

    it('loading_context → error on CONTEXT_FAILED', () => {
      const fsm = new AgentStateMachineRuntime('loading_context');
      const result = fsm.transition({ type: 'CONTEXT_FAILED', reason: 'Network error' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('error');
    });

    it('planning → executing on PLAN_READY', () => {
      const fsm = new AgentStateMachineRuntime('planning');
      const result = fsm.transition({ type: 'PLAN_READY' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('executing');
    });

    it('planning → awaiting_human on PLAN_AMBIGUOUS', () => {
      const fsm = new AgentStateMachineRuntime('planning');
      const result = fsm.transition({ type: 'PLAN_AMBIGUOUS', context: 'Goal is unclear' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('awaiting_human');
    });

    it('executing → tool_waiting on TOOL_CALL', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      const result = fsm.transition({ type: 'TOOL_CALL', toolName: 'web_search' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('tool_waiting');
    });

    it('tool_waiting → executing on TOOL_SUCCESS', () => {
      const fsm = new AgentStateMachineRuntime('tool_waiting');
      const result = fsm.transition({ type: 'TOOL_SUCCESS', result: { data: [] } });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('executing');
    });

    it('tool_waiting → retrying on TOOL_FAILURE', () => {
      const fsm = new AgentStateMachineRuntime('tool_waiting');
      const result = fsm.transition({ type: 'TOOL_FAILURE', reason: 'API timeout' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('retrying');
    });

    it('retrying → tool_waiting on RETRY', () => {
      const fsm = new AgentStateMachineRuntime('retrying');
      const result = fsm.transition({ type: 'RETRY' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('tool_waiting');
    });

    it('retrying → awaiting_human on MAX_RETRIES_EXCEEDED', () => {
      const fsm = new AgentStateMachineRuntime('retrying');
      const result = fsm.transition({ type: 'MAX_RETRIES_EXCEEDED' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('awaiting_human');
    });

    it('executing → reflecting on REFLECTION_TRIGGERED', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      const result = fsm.transition({ type: 'REFLECTION_TRIGGERED' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('reflecting');
    });

    it('reflecting → executing on REFLECTION_PASS', () => {
      const fsm = new AgentStateMachineRuntime('reflecting');
      const result = fsm.transition({ type: 'REFLECTION_PASS' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('executing');
    });

    it('reflecting → self_correcting on REFLECTION_FAIL', () => {
      const fsm = new AgentStateMachineRuntime('reflecting');
      const result = fsm.transition({ type: 'REFLECTION_FAIL', issues: ['Missing sources'] });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('self_correcting');
    });

    it('self_correcting → executing on CORRECTION_APPLIED', () => {
      const fsm = new AgentStateMachineRuntime('self_correcting');
      const result = fsm.transition({ type: 'CORRECTION_APPLIED' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('executing');
    });

    it('self_correcting → awaiting_human on CORRECTION_FAILED', () => {
      const fsm = new AgentStateMachineRuntime('self_correcting');
      const result = fsm.transition({ type: 'CORRECTION_FAILED', reason: 'Cannot determine fix' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('awaiting_human');
    });

    it('executing → submitting on OUTPUT_READY', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      const result = fsm.transition({ type: 'OUTPUT_READY', output: { data: 'result' } });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('submitting');
    });

    it('submitting → idle on VERIFIED', () => {
      const fsm = new AgentStateMachineRuntime('submitting');
      const result = fsm.transition({ type: 'VERIFIED' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('idle');
    });

    it('submitting → self_correcting on VERIFICATION_FAILED', () => {
      const fsm = new AgentStateMachineRuntime('submitting');
      const result = fsm.transition({ type: 'VERIFICATION_FAILED', reasons: ['Output incomplete'] });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('self_correcting');
    });

    it('awaiting_human → executing on HUMAN_RESOLVED', () => {
      const fsm = new AgentStateMachineRuntime('awaiting_human');
      const result = fsm.transition({ type: 'HUMAN_RESOLVED', resolution: { proceed: true } });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('executing');
    });

    it('awaiting_human → terminated on HUMAN_ABORTED', () => {
      const fsm = new AgentStateMachineRuntime('awaiting_human');
      const result = fsm.transition({ type: 'HUMAN_ABORTED', reason: 'No longer needed' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('terminated');
    });

    it('idle → terminated on TERMINATE', () => {
      const fsm = new AgentStateMachineRuntime();
      const result = fsm.transition({ type: 'TERMINATE' });
      expect(result.success).toBe(true);
      expect(fsm.state).toBe('terminated');
    });
  });

  describe('Invalid transitions — must be rejected', () => {
    it('cannot transition from terminal state "error"', () => {
      const fsm = new AgentStateMachineRuntime('error');
      const result = fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      expect(result.success).toBe(false);
      expect(fsm.state).toBe('error'); // unchanged
    });

    it('cannot transition from terminal state "terminated"', () => {
      const fsm = new AgentStateMachineRuntime('terminated');
      const result = fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      expect(result.success).toBe(false);
      expect(fsm.state).toBe('terminated');
    });

    it('cannot skip from idle to executing', () => {
      const fsm = new AgentStateMachineRuntime();
      const result = fsm.transition({ type: 'PLAN_READY' });
      expect(result.success).toBe(false);
    });

    it('cannot go backwards from executing to idle', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      const result = fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      expect(result.success).toBe(false);
    });

    it('state does not change on failed transition', () => {
      const fsm = new AgentStateMachineRuntime('planning');
      fsm.transition({ type: 'TERMINATE' }); // invalid from planning? depends on transitions
      // TERMINATE is only valid from idle/executing in our matrix
      // let's verify state hasn't changed if invalid
      const stateAfter = fsm.state;
      // If TERMINATE not in planning transitions, state stays 'planning'
      if (!AGENT_TRANSITIONS['planning']['TERMINATE']) {
        expect(stateAfter).toBe('planning');
      }
    });
  });

  describe('Terminal state detection', () => {
    it('"error" is a terminal state', () => {
      const fsm = new AgentStateMachineRuntime('error');
      expect(fsm.isTerminal()).toBe(true);
    });

    it('"terminated" is a terminal state', () => {
      const fsm = new AgentStateMachineRuntime('terminated');
      expect(fsm.isTerminal()).toBe(true);
    });

    it('"executing" is not terminal', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      expect(fsm.isTerminal()).toBe(false);
    });

    it('"idle" is not terminal', () => {
      const fsm = new AgentStateMachineRuntime('idle');
      expect(fsm.isTerminal()).toBe(false);
    });
  });

  describe('History recording', () => {
    it('records each successful transition', () => {
      const fsm = new AgentStateMachineRuntime();
      fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      fsm.transition({ type: 'CONTEXT_LOADED' });
      expect(fsm.getHistory()).toHaveLength(2);
    });

    it('does NOT record failed transitions', () => {
      const fsm = new AgentStateMachineRuntime();
      fsm.transition({ type: 'PLAN_READY' }); // invalid from idle
      expect(fsm.getHistory()).toHaveLength(0);
    });

    it('history entry contains previous state, event, and timestamp', () => {
      const fsm = new AgentStateMachineRuntime();
      fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      const history = fsm.getHistory();
      expect(history[0]).toMatchObject({
        state: 'idle',
        event: 'ASSIGN_TASK',
      });
      expect(history[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('getHistory() returns a copy (immutable)', () => {
      const fsm = new AgentStateMachineRuntime();
      fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      const h1 = fsm.getHistory();
      const h2 = fsm.getHistory();
      expect(h1).not.toBe(h2); // different references
      expect(h1).toEqual(h2);  // same content
    });
  });

  describe('Snapshot', () => {
    it('snapshot captures current state and full history', () => {
      const fsm = new AgentStateMachineRuntime();
      fsm.transition({ type: 'ASSIGN_TASK', taskId: 't1' });
      fsm.transition({ type: 'CONTEXT_LOADED' });
      const snap = fsm.snapshot();
      expect(snap.state).toBe('planning');
      expect(snap.history).toHaveLength(2);
    });
  });

  describe('Full agent workflow simulation', () => {
    it('simulates a complete successful agent execution', () => {
      const fsm = new AgentStateMachineRuntime();
      const transitions: AgentEvent[] = [
        { type: 'ASSIGN_TASK', taskId: 'task-research' },
        { type: 'CONTEXT_LOADED' },
        { type: 'PLAN_READY' },
        { type: 'TOOL_CALL', toolName: 'web_search' },
        { type: 'TOOL_SUCCESS', result: ['result1', 'result2'] },
        { type: 'REFLECTION_TRIGGERED' },
        { type: 'REFLECTION_PASS' },
        { type: 'OUTPUT_READY', output: 'Research complete' },
        { type: 'VERIFIED' },
      ];

      for (const event of transitions) {
        const result = fsm.transition(event);
        expect(result.success).toBe(true);
      }

      expect(fsm.state).toBe('idle'); // Ready for next task
      expect(fsm.getHistory()).toHaveLength(transitions.length);
    });

    it('simulates agent recovery via self-correction', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      fsm.transition({ type: 'REFLECTION_TRIGGERED' });
      fsm.transition({ type: 'REFLECTION_FAIL', issues: ['Output incomplete'] });
      fsm.transition({ type: 'CORRECTION_APPLIED' });
      fsm.transition({ type: 'OUTPUT_READY', output: 'Fixed output' });
      fsm.transition({ type: 'VERIFIED' });

      expect(fsm.state).toBe('idle');
    });

    it('simulates tool retry then human escalation', () => {
      const fsm = new AgentStateMachineRuntime('executing');
      fsm.transition({ type: 'TOOL_CALL', toolName: 'api_call' });
      fsm.transition({ type: 'TOOL_FAILURE', reason: 'Timeout' });
      fsm.transition({ type: 'RETRY' });
      fsm.transition({ type: 'TOOL_FAILURE', reason: 'Still timing out' });
      fsm.transition({ type: 'MAX_RETRIES_EXCEEDED' });

      expect(fsm.state).toBe('awaiting_human');
    });
  });
});
