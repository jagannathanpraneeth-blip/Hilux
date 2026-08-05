/**
 * MarketingDepartment — Brand, Content, Growth, Demand Generation.
 *
 * Workers: Content Writer, Growth Marketer, Brand Strategist, SEO Specialist, Social Media Manager
 * Produces: Content, campaigns, landing pages, newsletters, social posts, growth experiments
 * Feeds into: Product (positioning), Analytics (campaign performance), Sales
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createMarketingDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'marketing',
    name: 'Marketing',
    mission: 'Drive awareness, acquisition, and retention for Hilux',
    headId,
    budget: { monthly: 200_000, used: 0, currency: 'USD' },
    minWorkers: 2,
    maxWorkers: 20,
    kpis: [
      { name: 'MQL Generated', target: 500, current: 0, unit: 'per_month', trend: 'stable' },
      { name: 'Content Pieces Published', target: 20, current: 0, unit: 'per_month', trend: 'stable' },
      { name: 'CAC', target: 500, current: 0, unit: 'usd', trend: 'stable' },
      { name: 'Brand Sentiment Score', target: 80, current: 0, unit: 'nps', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Content Writer',
        seniority: 'mid',
        minCount: 1,
        maxCount: 8,
        specializations: ['technical_writing', 'blog_posts', 'case_studies', 'copywriting'],
        costPerHour: 1.80,
      },
      {
        role: 'Growth Marketer',
        seniority: 'senior',
        minCount: 1,
        maxCount: 5,
        specializations: ['growth_hacking', 'a_b_testing', 'funnel_optimization', 'paid_acquisition'],
        costPerHour: 3.00,
      },
      {
        role: 'SEO Specialist',
        seniority: 'mid',
        minCount: 0,
        maxCount: 4,
        specializations: ['seo', 'keyword_research', 'on_page_optimization', 'link_building'],
        costPerHour: 2.20,
      },
    ],
  };
}

class MarketingWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Executing marketing task: "${goal.title}"`);

    const content = await this.createContent(goal);
    await this.shareKnowledge({
      type: 'best_practice',
      content,
      domain: 'marketing',
      confidence: 0.80,
      sourceTaskId: goal.goalId,
    });

    // Notify analytics to track campaign
    await this.messageBus.publish('department.analytics.request', {
      type: 'track_campaign',
      from: this.profile.workerId,
      campaignName: goal.title,
      kpis: ['impressions', 'clicks', 'conversions'],
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { content });
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.83,
      timeToComplete: 60, tokensUsed: 3000, costUsd: 1.20,
    });
  }

  private async createContent(goal: WorkerGoal): Promise<string> {
    const context = await this.recallContext(goal.description);
    return `# ${goal.title}\n\n[LLM-generated content based on: ${goal.description}]\n\nPast learnings applied: ${context.relevantKnowledge.slice(0, 1).join('')}`;
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'campaign_performance') {
      await this.learn(
        [`Campaign "${message['campaign']}" achieved ${message['ctr']}% CTR`],
        message['ctr'] as number > 2 ? [] : ['Improve headline copy', 'Test different CTAs']
      );
    }
  }
}

export class MarketingDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new MarketingWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
