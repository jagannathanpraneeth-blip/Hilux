/**
 * ResearchDepartment — AI Research, Market Research, Competitive Intelligence.
 *
 * Workers: Research Scientist, Market Researcher, Data Analyst, Competitive Analyst
 * Produces: Research reports, datasets, insights, recommendations
 * Feeds into: Product (roadmap), Engineering (technical feasibility), Marketing (positioning)
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createResearchDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'research',
    name: 'Research',
    mission: 'Generate actionable intelligence that drives product and business decisions',
    headId,
    budget: { monthly: 100_000, used: 0, currency: 'USD' },
    minWorkers: 2,
    maxWorkers: 15,
    kpis: [
      { name: 'Research Reports Published', target: 8, current: 0, unit: 'per_month', trend: 'stable' },
      { name: 'Insights Adopted by Product', target: 70, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Research Accuracy', target: 90, current: 0, unit: 'percent', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Research Scientist',
        seniority: 'senior',
        minCount: 1,
        maxCount: 5,
        specializations: ['ai_research', 'literature_review', 'hypothesis_testing', 'paper_synthesis'],
        costPerHour: 4.00,
      },
      {
        role: 'Market Researcher',
        seniority: 'mid',
        minCount: 1,
        maxCount: 5,
        specializations: ['market_sizing', 'customer_segmentation', 'survey_analysis', 'trend_analysis'],
        costPerHour: 2.50,
      },
      {
        role: 'Competitive Analyst',
        seniority: 'mid',
        minCount: 0,
        maxCount: 5,
        specializations: ['competitor_analysis', 'positioning', 'pricing_research', 'feature_benchmarking'],
        costPerHour: 2.50,
      },
    ],
  };
}

class ResearchWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Researching: "${goal.title}"`);
    const context = await this.recallContext(goal.description);

    // Research cycle: gather sources → analyze → synthesize → validate
    const sources = await this.gatherSources(goal);
    const analysis = await this.analyze(sources, goal);
    const report = await this.synthesize(analysis, goal);

    await this.shareKnowledge({
      type: 'fact',
      content: report,
      domain: this.profile.specializations[0] ?? 'research',
      confidence: 0.85,
      sourceTaskId: goal.goalId,
    });

    // Publish findings to relevant departments
    await this.messageBus.publish('department.product.request', {
      type: 'research_findings',
      from: this.profile.workerId,
      fromRole: this.profile.role,
      goal: goal.title,
      findings: report,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { report });
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.87,
      timeToComplete: 180, tokensUsed: 8000, costUsd: 3.20,
    });
  }

  private async gatherSources(goal: WorkerGoal): Promise<string[]> {
    return [`Source 1 for ${goal.title}`, `Source 2 for ${goal.title}`];
  }
  private async analyze(sources: string[], goal: WorkerGoal): Promise<string> {
    return `Analysis of ${sources.length} sources for: ${goal.title}`;
  }
  private async synthesize(analysis: string, goal: WorkerGoal): Promise<string> {
    return `Research Report: ${goal.title}\n\n${analysis}\n\nKey Findings: [LLM-generated in production]`;
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'research_request') {
      await this.acceptGoal({
        goalId: crypto.randomUUID(),
        title: message['topic'] as string,
        description: message['description'] as string,
        priority: 'medium',
        acceptanceCriteria: ['Report delivered'],
        assignedBy: message['requesterId'] as string,
        assignedAt: new Date(),
      });
    }
  }
}

export class ResearchDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new ResearchWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
