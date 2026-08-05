/**
 * DecisionEngine — Structured autonomous decision-making for workers.
 *
 * Evaluates options using:
 * - Risk-weighted scoring
 * - Confidence calibration
 * - Past decision outcome learning
 * - Autonomy level constraints
 */

import type { AutonomyLevel, WorkerDecision } from '../worker/BaseWorker.js';

interface DecisionOption {
  option: string;
  rationale: string;
  risk: 'low' | 'medium' | 'high';
  impactLevel: 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
}

export class DecisionEngine {
  private workerId: string;
  private autonomyLevel: AutonomyLevel;
  private decisionHistory: WorkerDecision[] = [];

  constructor(workerId: string, autonomyLevel: AutonomyLevel) {
    this.workerId = workerId;
    this.autonomyLevel = autonomyLevel;
  }

  setAutonomyLevel(level: AutonomyLevel): void {
    this.autonomyLevel = level;
  }

  async evaluate(
    question: string,
    options: DecisionOption[]
  ): Promise<WorkerDecision> {
    const riskWeight = { low: 1.0, medium: 0.7, high: 0.4 };

    // Score each option
    const scored = options.map(opt => ({
      ...opt,
      score: riskWeight[opt.risk] * this.getAutonomyMultiplier(opt.impactLevel),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (!best) {
      throw new Error('No decision options provided');
    }

    // Confidence: based on risk level and how clear the best option is
    const topScore = best.score;
    const secondScore = scored[1]?.score ?? 0;
    const separation = topScore - secondScore;
    const confidence = Math.min(0.95, 0.5 + separation + (riskWeight[best.risk] * 0.3));

    const decision: WorkerDecision = {
      decisionId: crypto.randomUUID(),
      question,
      options: options.map(o => ({ option: o.option, rationale: o.rationale, risk: o.risk })),
      chosen: best.option,
      confidence,
      rationale: best.rationale,
      escalated: false,
      timestamp: new Date(),
    };

    this.decisionHistory.push(decision);
    return decision;
  }

  private getAutonomyMultiplier(impactLevel: DecisionOption['impactLevel']): number {
    const autonomyMatrix: Record<AutonomyLevel, Record<string, number>> = {
      supervised: { trivial: 0.9, minor: 0.5, moderate: 0.2, major: 0.0, critical: 0.0 },
      guided: { trivial: 1.0, minor: 0.9, moderate: 0.5, major: 0.2, critical: 0.0 },
      independent: { trivial: 1.0, minor: 1.0, moderate: 0.9, major: 0.5, critical: 0.2 },
      executive: { trivial: 1.0, minor: 1.0, moderate: 1.0, major: 0.9, critical: 0.7 },
    };
    return autonomyMatrix[this.autonomyLevel][impactLevel] ?? 0.5;
  }
}
