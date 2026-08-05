/**
 * FinanceDepartment — Budget, Forecasting, Accounting, Financial Analysis.
 *
 * Workers: Financial Analyst, Accountant, Budget Manager, Forecasting Specialist
 * Produces: P&L reports, budget allocations, financial forecasts, cost analysis
 * Feeds into: CEO (decisions), Operations (resource allocation)
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createFinanceDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'finance',
    name: 'Finance',
    mission: 'Ensure financial health, forecasting accuracy, and budget discipline',
    headId,
    budget: { monthly: 50_000, used: 0, currency: 'USD' },
    minWorkers: 2,
    maxWorkers: 10,
    kpis: [
      { name: 'Forecast Accuracy', target: 95, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Budget Variance', target: 5, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Report Delivery On-Time', target: 100, current: 0, unit: 'percent', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Financial Analyst',
        seniority: 'senior',
        minCount: 1,
        maxCount: 5,
        specializations: ['financial_modeling', 'p&l_analysis', 'unit_economics', 'investor_reporting'],
        costPerHour: 3.50,
      },
      {
        role: 'Budget Manager',
        seniority: 'mid',
        minCount: 1,
        maxCount: 5,
        specializations: ['budget_allocation', 'cost_tracking', 'variance_analysis', 'forecasting'],
        costPerHour: 2.80,
      },
    ],
  };
}

class FinanceWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Processing: "${goal.title}"`);

    const report = await this.generateFinancialReport(goal);

    await this.shareKnowledge({
      type: 'fact',
      content: report,
      domain: 'financial_data',
      confidence: 0.95,
    });

    // Report to CEO
    await this.messageBus.publish('worker.exec-ceo-001', {
      type: 'financial_report',
      from: this.profile.workerId,
      report,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { report });
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.92,
      timeToComplete: 30, tokensUsed: 2000, costUsd: 0.80,
    });
  }

  private async generateFinancialReport(goal: WorkerGoal): Promise<string> {
    return `Financial Report: ${goal.title}\n\nGenerated at: ${new Date().toISOString()}\n[LLM-generated analysis in production]`;
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'budget_request') {
      const approved = (message['amount'] as number) < 10_000;
      await this.communicate(message['requesterId'] as string, {
        type: 'budget_decision',
        approved,
        amount: message['amount'],
        reason: approved ? 'Within budget limits' : 'Requires CFO approval',
      });
    }
  }
}

export class FinanceDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new FinanceWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
