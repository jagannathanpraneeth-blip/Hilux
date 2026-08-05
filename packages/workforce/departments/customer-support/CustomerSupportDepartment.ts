/**
 * CustomerSupportDepartment — Tier 1, Tier 2, Customer Success, Escalation.
 *
 * Workers: Support Agent (T1), Senior Support (T2), Customer Success Manager, Technical Support
 * Produces: Ticket resolutions, escalation reports, customer health scores, feature requests
 * Feeds into: Product (bugs/feedback), Engineering (technical issues), Analytics (satisfaction)
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createSupportDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'customer_support',
    name: 'Customer Support',
    mission: 'Deliver world-class support that turns frustrated users into loyal advocates',
    headId,
    budget: { monthly: 120_000, used: 0, currency: 'USD' },
    minWorkers: 3,
    maxWorkers: 30,
    kpis: [
      { name: 'First Response Time', target: 1, current: 0, unit: 'hours', trend: 'stable' },
      { name: 'Resolution Time', target: 24, current: 0, unit: 'hours', trend: 'stable' },
      { name: 'CSAT Score', target: 90, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Ticket Deflection Rate', target: 40, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'First Contact Resolution', target: 75, current: 0, unit: 'percent', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Support Agent',
        seniority: 'junior',
        minCount: 2,
        maxCount: 20,
        specializations: ['customer_communication', 'ticket_triage', 'product_knowledge', 'empathy'],
        costPerHour: 1.50,
      },
      {
        role: 'Senior Support Specialist',
        seniority: 'senior',
        minCount: 1,
        maxCount: 8,
        specializations: ['technical_support', 'escalation_handling', 'complex_troubleshooting'],
        costPerHour: 2.50,
      },
      {
        role: 'Customer Success Manager',
        seniority: 'senior',
        minCount: 0,
        maxCount: 5,
        specializations: ['account_management', 'onboarding', 'churn_prevention', 'upsell'],
        costPerHour: 3.00,
      },
    ],
  };
}

class SupportWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Handling support ticket: "${goal.title}"`);

    const resolution = await this.resolveTicket(goal);

    if (!resolution.resolved) {
      // Escalate to Tier 2 or Engineering
      await this.escalate({
        urgency: 'medium',
        context: `Cannot resolve: ${goal.title}. Issue: ${resolution.blockingIssue}`,
        blockedTask: goal.goalId,
        recommendation: resolution.suggestedPath,
      });
      return;
    }

    // Share resolution as knowledge for future similar issues
    await this.shareKnowledge({
      type: 'procedure',
      content: `Solution for "${goal.title}": ${resolution.solution}`,
      domain: 'customer_support_playbooks',
      confidence: 0.88,
      sourceTaskId: goal.goalId,
    });

    // Send customer satisfaction request
    await this.communicate(goal.assignedBy, {
      type: 'ticket_resolved',
      ticketId: goal.goalId,
      title: goal.title,
      solution: resolution.solution,
      requestCsat: true,
    });

    // Route feature feedback to product
    if (resolution.featureRequest) {
      await this.messageBus.publish('department.product.request', {
        type: 'feature_request',
        from: this.profile.workerId,
        request: resolution.featureRequest,
        customerImpact: 'medium',
      });
    }

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, resolution);
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.85,
      timeToComplete: 20, tokensUsed: 1500, costUsd: 0.40,
    });
  }

  private async resolveTicket(goal: WorkerGoal): Promise<{
    resolved: boolean;
    solution: string;
    blockingIssue?: string | undefined;
    suggestedPath?: string | undefined;
    featureRequest?: string | undefined;
  }> {
    const context = await this.recallContext(goal.description);
    const hasSolution = context.applicableSkills.length > 0;

    return {
      resolved: hasSolution || Math.random() > 0.2,
      solution: hasSolution ? context.applicableSkills[0] ?? 'Standard resolution applied' : 'Resolution applied',
      featureRequest: goal.description.includes('feature') ? goal.description : undefined,
    };
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'csat_received') {
      const score = message['score'] as number;
      await this.learn(
        [`CSAT score ${score}/10 for ticket: ${message['ticketId']}`],
        score < 7 ? ['Improve solution clarity', 'Follow up proactively'] : []
      );
    }
  }
}

export class CustomerSupportDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new SupportWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
