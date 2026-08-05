/**
 * DAGTopologicalSorter — Pure domain service for workflow execution ordering.
 *
 * Given a Mission DAG (Directed Acyclic Graph), computes the execution
 * schedule: which tasks can run in parallel, which must run sequentially.
 *
 * Algorithm: Kahn's algorithm for topological sort
 * Complexity: O(V + E) where V = tasks, E = dependencies
 *
 * WHY a domain service (not an entity): This logic operates across
 * multiple nodes and edges with no single aggregate identity.
 * It belongs in the domain but spans multiple aggregates.
 */
import type { MissionDAG, TaskNode, TaskEdge } from '../../../mission/domain/aggregates/MissionAggregate.js';

export interface ExecutionLayer {
  layerIndex: number;
  taskIds: string[];         // Can all run in parallel
  dependsOnLayers: number[]; // Must complete before this layer
}

export interface ExecutionSchedule {
  layers: ExecutionLayer[];
  criticalPath: string[];    // Longest dependency chain (bottleneck)
  parallelismFactor: number; // avg tasks per layer (higher = more parallel)
}

export class DAGTopologicalSorter {
  /**
   * Compute execution schedule from mission DAG.
   * Throws if a cycle is detected (should be impossible from Planner,
   * but we validate defensively).
   */
  computeSchedule(dag: MissionDAG): ExecutionSchedule {
    const { nodes, edges } = dag;

    // Build adjacency structures
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // task → tasks that depend on it

    for (const node of nodes) {
      inDegree.set(node.taskId, 0);
      dependents.set(node.taskId, []);
    }

    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      dependents.get(edge.from)!.push(edge.to);
    }

    // Kahn's algorithm — build layers of parallel tasks
    const layers: ExecutionLayer[] = [];
    let currentLayer = [...inDegree.entries()]
      .filter(([, deg]) => deg === 0)
      .map(([id]) => id);

    if (currentLayer.length === 0 && nodes.length > 0) {
      throw new Error('Mission DAG contains a cycle — invalid mission structure');
    }

    let layerIndex = 0;
    const processed = new Set<string>();

    while (currentLayer.length > 0) {
      layers.push({
        layerIndex,
        taskIds: [...currentLayer],
        dependsOnLayers: layerIndex > 0 ? [layerIndex - 1] : [],
      });

      const nextLayer: string[] = [];
      for (const taskId of currentLayer) {
        processed.add(taskId);
        for (const dependent of dependents.get(taskId) ?? []) {
          const newDegree = (inDegree.get(dependent) ?? 0) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) nextLayer.push(dependent);
        }
      }

      currentLayer = nextLayer;
      layerIndex++;
    }

    if (processed.size !== nodes.length) {
      throw new Error('Mission DAG contains a cycle — not all tasks were reachable');
    }

    return {
      layers,
      criticalPath: this.computeCriticalPath(dag, layers),
      parallelismFactor: layers.length > 0
        ? nodes.length / layers.length
        : 0,
    };
  }

  /**
   * Critical path: the longest chain of sequential dependencies.
   * Tasks on the critical path are the bottleneck — prioritize them.
   */
  private computeCriticalPath(dag: MissionDAG, layers: ExecutionLayer[]): string[] {
    const { nodes, edges } = dag;
    const longestPath = new Map<string, number>();
    const pathTo = new Map<string, string[]>();

    for (const node of nodes) {
      longestPath.set(node.taskId, 0);
      pathTo.set(node.taskId, [node.taskId]);
    }

    // Sort topologically using already computed layers
    const sorted = layers.flatMap(l => l.taskIds);

    for (const taskId of sorted) {
      const predecessors = edges.filter(e => e.to === taskId).map(e => e.from);
      for (const pred of predecessors) {
        const candidateLength = (longestPath.get(pred) ?? 0) + 1;
        if (candidateLength > (longestPath.get(taskId) ?? 0)) {
          longestPath.set(taskId, candidateLength);
          pathTo.set(taskId, [...(pathTo.get(pred) ?? []), taskId]);
        }
      }
    }

    // Find task with maximum path length
    let maxLength = -1;
    let criticalPath: string[] = [];
    for (const [taskId, length] of longestPath) {
      if (length > maxLength) {
        maxLength = length;
        criticalPath = pathTo.get(taskId) ?? [taskId];
      }
    }

    return criticalPath;
  }
}
