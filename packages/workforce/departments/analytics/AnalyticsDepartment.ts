/**
 * AnalyticsDepartment — Data Analytics, Business Intelligence, Experimentation.
 *
 * Workers: Data Analyst, BI Developer, Experimentation Analyst, Data Engineer
 * Produces: Dashboards, A/B test reports, cohort analyses, predictive models
 * Feeds into: All departments (data-driven decisions)
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createAnalyticsDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'analytics',
    name: 'Analytics',
    mission: 'Make every team decision data-driven and every insight actionable',
    headId,
    budget: { monthly: 80_000, used: 0, currency: 'USD' },
    minWorkers: 2,
    maxWorkers: 12,
    kpis: [
      { name: 'Dashboard Adoption', target: 90, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Data Quality Score', target: 99, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Experiment Velocity', target: 4, current: 0, unit: 'per_month', trend: 'stable' },
      { name: 'Insight Response Time', target: 48, current: 0, unit: 'hours', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Data Analyst',
        seniority: 'mid',
        minCount: 1,
        maxCount: 6,
        specializations: ['sql', 'data_visualization', 'cohort_analysis', 'funnel_analysis'],
        costPerHour: 2.50,
      },
      {
        role: 'Experimentation Analyst',
        seniority: 'senior',
        minCount: 1,
        maxCount: 4,
        specializations: ['a_b_testing', 'statistical_significance', 'causal_inference', 'bayesian_analysis'],
        costPerHour: 3.20,
      },
      {
        role: 'Data Engineer',
        seniority: 'senior',
        minCount: 0,
        maxCount: 4,
        specializations: ['data_pipelines', 'etl', 'warehouse', 'stream_processing'],
        costPerHour: 3.50,
      },
    ],
  };
}

class AnalyticsWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Analyzing: "${goal.title}"`);

    const analysis = await this.runAnalysis(goal);

    // Share insight with relevant departments
    await this.shareKnowledge({
      type: 'fact',
      content: `Analytics insight for "${goal.title}": ${analysis.summary}`,
      domain: 'business_metrics',
      confidence: 0.90,
    });

    // Broadcast to all departments
    await this.broadcastToDepartment({
      type: 'analytics_insight',
      topic: goal.title,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, analysis);
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.91,
      timeToComplete: 60, tokensUsed: 5000, costUsd: 1.80,
    });
  }

  private async runAnalysis(goal: WorkerGoal): Promise<{
    summary: string;
    keyMetrics: Record<string, number>;
    recommendations: string[];
  }> {
    return {
      summary: `Analysis of ${goal.title}: [LLM-generated insights in production]`,
      keyMetrics: { conversion_rate: 0.032, retention: 0.78, revenue_growth: 0.15 },
      recommendations: ['Optimize onboarding funnel', 'Increase email campaign frequency'],
    };
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'data_request') {
      await this.acceptGoal({
        goalId: crypto.randomUUID(),
        title: `Analytics: ${message['metric']}`,
        description: message['description'] as string,
        priority: 'medium',
        acceptanceCriteria: ['Analysis complete', 'Insights delivered'],
        assignedBy: message['requesterId'] as string,
        assignedAt: new Date(),
      });
    }
    if (message['type'] === 'track_campaign') {
      console.log(`[Analytics] Tracking campaign: ${message['campaignName']}`);
    }
  }
}

export class AnalyticsDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new AnalyticsWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
