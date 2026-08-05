/**
 * PerformanceTracker — Real-time KPI tracking for workers and departments.
 *
 * Tracks: task completion rate, quality, efficiency, escalation rate,
 * learning velocity, autonomy, and computes a weighted overall score.
 *
 * Performance determines: autonomy level, promotion eligibility, termination risk.
 */

import type { ReflectionReport, EscalationRequest } from '../worker/BaseWorker.js';

interface TaskRecord {
  taskId: string;
  success: boolean;
  qualityScore: number;
  timeToComplete: number;
  tokensUsed: number;
  costUsd: number;
  timestamp: Date;
}

interface PerformanceSnapshot {
  overallScore: number;
  taskCompletionRate: number;
  averageQualityScore: number;
  averageEfficiencyScore: number;
  escalationRate: number;
  learningVelocity: number;
  autonomyScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

export class PerformanceTracker {
  private readonly entityId: string;
  private readonly entityRole: string;

  private taskHistory: TaskRecord[] = [];
  private reflections: ReflectionReport[] = [];
  private escalations: EscalationRequest[] = [];
  private learningsCount = 0;

  // Rolling window for trend calculation (last 20 tasks)
  private readonly WINDOW = 20;

  constructor(entityId: string, entityRole: string) {
    this.entityId = entityId;
    this.entityRole = entityRole;
  }

  recordTaskOutcome(outcome: {
    taskId: string;
    success: boolean;
    qualityScore: number;
    timeToComplete: number;
    tokensUsed: number;
    costUsd: number;
  }): void {
    this.taskHistory.push({ ...outcome, timestamp: new Date() });
    // Keep only last 100 tasks for memory efficiency
    if (this.taskHistory.length > 100) this.taskHistory.shift();
  }

  recordReflection(reflection: ReflectionReport): void {
    this.reflections.push(reflection);
    this.learningsCount += reflection.learnings.length;
    if (this.reflections.length > 50) this.reflections.shift();
  }

  recordEscalation(escalation: EscalationRequest): void {
    this.escalations.push(escalation);
    if (this.escalations.length > 50) this.escalations.shift();
  }

  getSnapshot(): PerformanceSnapshot {
    const recent = this.taskHistory.slice(-this.WINDOW);
    const older = this.taskHistory.slice(-this.WINDOW * 2, -this.WINDOW);

    if (recent.length === 0) {
      return {
        overallScore: 0.75,    // Default for new workers
        taskCompletionRate: 1.0,
        averageQualityScore: 0.75,
        averageEfficiencyScore: 0.75,
        escalationRate: 0,
        learningVelocity: 0,
        autonomyScore: 0.5,
        trend: 'stable',
      };
    }

    const taskCompletionRate = recent.filter(t => t.success).length / recent.length;
    const avgQuality = recent.reduce((s, t) => s + t.qualityScore, 0) / recent.length;
    const avgEfficiency = this.reflections.length > 0
      ? this.reflections.slice(-10).reduce((s, r) => s + r.efficiencyScore, 0) / Math.min(this.reflections.length, 10)
      : 0.75;
    const escalationRate = this.escalations.length / Math.max(recent.length, 1);
    const learningVelocity = this.learningsCount / Math.max(this.taskHistory.length, 1);

    // Overall score: weighted average
    const overallScore =
      taskCompletionRate * 0.30 +
      avgQuality * 0.30 +
      avgEfficiency * 0.20 +
      (1 - Math.min(escalationRate, 1)) * 0.10 +
      Math.min(learningVelocity, 1) * 0.10;

    // Trend: compare recent window to previous window
    let trend: PerformanceSnapshot['trend'] = 'stable';
    if (older.length >= 5) {
      const recentAvg = recent.reduce((s, t) => s + t.qualityScore, 0) / recent.length;
      const olderAvg = older.reduce((s, t) => s + t.qualityScore, 0) / older.length;
      if (recentAvg > olderAvg + 0.05) trend = 'improving';
      else if (recentAvg < olderAvg - 0.05) trend = 'declining';
    }

    return {
      overallScore,
      taskCompletionRate,
      averageQualityScore: avgQuality,
      averageEfficiencyScore: avgEfficiency,
      escalationRate,
      learningVelocity,
      autonomyScore: Math.max(0, 1 - escalationRate),
      trend,
    };
  }
}
