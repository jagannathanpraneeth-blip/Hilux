/**
 * DocumentationDepartment — Technical Writing, API Docs, User Guides, Changelogs.
 *
 * Workers: Technical Writer, API Documentation Specialist, Content Strategist
 * Produces: Docs site, API reference, tutorials, changelogs, onboarding guides
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createDocsDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'documentation',
    name: 'Documentation',
    mission: 'Make Hilux the best-documented AI platform in the world',
    headId,
    budget: { monthly: 40_000, used: 0, currency: 'USD' },
    minWorkers: 1,
    maxWorkers: 8,
    kpis: [
      { name: 'Docs Coverage', target: 95, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Docs Freshness', target: 14, current: 0, unit: 'days_max_stale', trend: 'stable' },
      { name: 'Docs NPS', target: 75, current: 0, unit: 'score', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Technical Writer',
        seniority: 'mid',
        minCount: 1,
        maxCount: 5,
        specializations: ['technical_writing', 'api_documentation', 'markdown', 'diagramming'],
        costPerHour: 2.00,
      },
      {
        role: 'Documentation Engineer',
        seniority: 'senior',
        minCount: 0,
        maxCount: 3,
        specializations: ['docs_infrastructure', 'auto_doc_generation', 'openapi', 'docs_testing'],
        costPerHour: 2.80,
      },
    ],
  };
}

class DocumentationWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Documenting: "${goal.title}"`);

    const doc = await this.writeDocumentation(goal);

    await this.shareKnowledge({
      type: 'procedure',
      content: doc,
      domain: 'documentation',
      confidence: 0.90,
      sourceTaskId: goal.goalId,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { doc });
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.89,
      timeToComplete: 45, tokensUsed: 3500, costUsd: 0.90,
    });
  }

  private async writeDocumentation(goal: WorkerGoal): Promise<string> {
    const context = await this.recallContext(goal.description);
    return [
      `# ${goal.title}`,
      ``,
      `## Overview`,
      `${goal.description}`,
      ``,
      `## Quick Start`,
      `[LLM-generated quickstart in production]`,
      ``,
      `## API Reference`,
      `[Auto-generated from code in production]`,
      ``,
      `## Examples`,
      `[Generated from test cases in production]`,
    ].join('\n');
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'doc_update_required') {
      await this.acceptGoal({
        goalId: crypto.randomUUID(),
        title: `Update docs: ${message['component']}`,
        description: `Update documentation for changed component: ${message['component']}`,
        priority: 'medium',
        acceptanceCriteria: ['Docs updated', 'Examples verified', 'Changelog entry added'],
        assignedBy: message['requesterId'] as string ?? 'system',
        assignedAt: new Date(),
      });
    }
  }
}

export class DocumentationDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new DocumentationWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
