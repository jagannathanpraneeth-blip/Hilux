/**
 * ─── WORKFLOW ENGINE TESTS ────────────────────────────────────────────────────
 * Tests for the DAGTopologicalSorter:
 *   - Linear chains
 *   - Parallel fanout
 *   - Diamond dependencies
 *   - Complex multi-phase DAGs
 *   - Cycle detection
 *   - Critical path computation
 */

import { describe, it, expect } from 'vitest';
import { DAGTopologicalSorter } from '../../packages/core/workflow/domain/domain-services/DAGTopologicalSorter.js';
import type { MissionDAG } from '../../packages/core/mission/domain/aggregates/MissionAggregate.js';

const sorter = new DAGTopologicalSorter();

function makeNode(taskId: string, phaseId = 'p1') {
  return {
    taskId,
    title: taskId,
    description: `Task ${taskId}`,
    requiredCapabilities: [],
    estimatedTokens: 1000,
    phaseId,
  };
}

function makeDAG(
  nodeIds: string[],
  edges: Array<[string, string]>,
  phases: Array<{ phaseId: string; taskIds: string[] }> = [{ phaseId: 'p1', name: 'p1', taskIds: nodeIds }]
): MissionDAG {
  return {
    nodes: nodeIds.map(id => makeNode(id)),
    edges: edges.map(([from, to]) => ({ from, to })),
    totalTasks: nodeIds.length,
    phases: phases.map(p => ({ ...p, name: p.phaseId })),
  };
}

describe('DAGTopologicalSorter — Execution Scheduling', () => {

  describe('Single node', () => {
    it('single task with no dependencies runs in layer 0', () => {
      const dag = makeDAG(['t1'], []);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers).toHaveLength(1);
      expect(schedule.layers[0]?.taskIds).toContain('t1');
    });

    it('critical path for single node is that node', () => {
      const dag = makeDAG(['t1'], []);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.criticalPath).toContain('t1');
    });
  });

  describe('Linear chain: A → B → C', () => {
    it('produces 3 sequential layers', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers).toHaveLength(3);
    });

    it('each task is in its own layer', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers[0]?.taskIds).toEqual(['A']);
      expect(schedule.layers[1]?.taskIds).toEqual(['B']);
      expect(schedule.layers[2]?.taskIds).toEqual(['C']);
    });

    it('parallelism factor is 1.0 (no parallelism)', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.parallelismFactor).toBe(1); // 3 tasks / 3 layers
    });

    it('critical path is full chain A→B→C', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.criticalPath).toContain('A');
      expect(schedule.criticalPath).toContain('B');
      expect(schedule.criticalPath).toContain('C');
    });
  });

  describe('Parallel tasks: A → [B, C] → D', () => {
    it('B and C execute in parallel in layer 1', () => {
      const dag = makeDAG(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers).toHaveLength(3); // Layer0: A, Layer1: B+C, Layer2: D
      const layer1 = schedule.layers[1]?.taskIds ?? [];
      expect(layer1).toContain('B');
      expect(layer1).toContain('C');
      expect(layer1).toHaveLength(2);
    });

    it('parallelism factor > 1 for parallel tasks', () => {
      const dag = makeDAG(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']]);
      const schedule = sorter.computeSchedule(dag);
      // 4 tasks, 3 layers → avg 4/3 ≈ 1.33
      expect(schedule.parallelismFactor).toBeCloseTo(4 / 3, 5);
    });
  });

  describe('Fully independent tasks', () => {
    it('all tasks execute in layer 0', () => {
      const dag = makeDAG(['t1', 't2', 't3', 't4', 't5'], []);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers).toHaveLength(1);
      expect(schedule.layers[0]?.taskIds).toHaveLength(5);
    });

    it('maximum parallelism factor equals task count', () => {
      const dag = makeDAG(['t1', 't2', 't3'], []);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.parallelismFactor).toBe(3); // 3 tasks / 1 layer
    });
  });

  describe('Complex DAG — multi-phase', () => {
    /**
     * Graph:
     *   A ──┐
     *   B ──┤──► D ──► F
     *   C ──┘
     *            E ──► F
     */
    it('complex dependency graph is correctly scheduled', () => {
      const dag = makeDAG(
        ['A', 'B', 'C', 'D', 'E', 'F'],
        [['A', 'D'], ['B', 'D'], ['C', 'D'], ['D', 'F'], ['E', 'F']]
      );
      const schedule = sorter.computeSchedule(dag);

      // A, B, C, E should all be in layer 0 (no dependencies)
      const layer0 = schedule.layers[0]?.taskIds ?? [];
      expect(layer0).toContain('A');
      expect(layer0).toContain('B');
      expect(layer0).toContain('C');
      expect(layer0).toContain('E');

      // D must come after A, B, C
      const dLayer = schedule.layers.findIndex(l => l.taskIds.includes('D'));
      const aLayer = schedule.layers.findIndex(l => l.taskIds.includes('A'));
      expect(dLayer).toBeGreaterThan(aLayer);

      // F must come after D
      const fLayer = schedule.layers.findIndex(l => l.taskIds.includes('F'));
      expect(fLayer).toBeGreaterThan(dLayer);
    });
  });

  describe('Layer dependency tracking', () => {
    it('each layer knows which previous layers it depends on', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers[0]?.dependsOnLayers).toEqual([]);     // root
      expect(schedule.layers[1]?.dependsOnLayers).toEqual([0]);    // depends on layer 0
      expect(schedule.layers[2]?.dependsOnLayers).toEqual([1]);    // depends on layer 1
    });
  });

  describe('Cycle detection', () => {
    it('throws on a simple cycle A → B → A', () => {
      const dag = makeDAG(['A', 'B'], [['A', 'B'], ['B', 'A']]);
      expect(() => sorter.computeSchedule(dag)).toThrow(/cycle/i);
    });

    it('throws on a self-loop A → A', () => {
      const dag = makeDAG(['A'], [['A', 'A']]);
      expect(() => sorter.computeSchedule(dag)).toThrow(/cycle/i);
    });

    it('throws on 3-node cycle A → B → C → A', () => {
      const dag = makeDAG(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']]);
      expect(() => sorter.computeSchedule(dag)).toThrow(/cycle/i);
    });
  });

  describe('Empty DAG edge cases', () => {
    it('empty DAG produces empty schedule', () => {
      const dag = makeDAG([], []);
      const schedule = sorter.computeSchedule(dag);
      expect(schedule.layers).toHaveLength(0);
      expect(schedule.criticalPath).toHaveLength(0);
      expect(schedule.parallelismFactor).toBe(0);
    });
  });
});
