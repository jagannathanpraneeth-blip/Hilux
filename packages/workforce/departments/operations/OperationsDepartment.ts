/**
 * OperationsDepartment — Business Operations, Process Improvement, Project Management, IT.
 *
 * Workers: Operations Manager, Process Analyst, Project Coordinator, IT Ops
 * Produces: Process playbooks, operational reports, project status, system health
 * Feeds into: All departments (operational excellence)
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createOperationsDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'operations',
    name: 'Operations',
    mission: 'Run the company like a well-oiled machine — eliminate friction, amplify output',
    headId,
    budget: { monthly: 100_000, used: 0, currency: 'USD' },
    minWorkers: 2,
    maxWorkers: 12,
    kpis: [
      { name: 'Process Efficiency Score', target: 85, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Operational Incidents', target: 0, current: 0, unit: 'per_week', trend: 'stable' },
      { name: 'Project On-Time Delivery', target: 90, current: 0, unit: 'percent', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Operations Manager',
        seniority: 'senior',
        minCount: 1,
        maxCount: 4,
        specializations: ['process_design', 'vendor_management', 'operational_planning', 'cross_dept_coordination'],
        costPerHour: 3.00,
      },
      {
        role: 'Project Coordinator',
        seniority: 'mid',
        minCount: 1,
        maxCount: 6,
        specializations: ['project_management', 'stakeholder_communication', 'risk_tracking', 'timeline_management'],
        costPerHour: 2.20,
      },
    ],
  };
}

class OperationsWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Operating: "${goal.title}"`);

    const output = await this.executeOperation(goal);

    await this.shareKnowledge({
      type: 'procedure',
      content: `Operational procedure for "${goal.title}": ${JSON.stringify(output)}`,
      domain: 'operations',
      confidence: 0.88,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, output);
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.87,
      timeToComplete: 30, tokensUsed: 2000, costUsd: 0.70,
    });
  }

  private async executeOperation(goal: WorkerGoal): Promise<Record<string, unknown>> {
    return { operation: goal.title, status: 'completed', processesUpdated: 1 };
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'process_improvement_request') {
      console.log(`[Ops] Process improvement requested: ${message['process']}`);
    }
  }
}

export class OperationsDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new OperationsWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
