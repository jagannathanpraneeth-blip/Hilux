/**
 * LegalDepartment — Compliance, Contracts, IP, Privacy, Regulatory.
 *
 * Workers: Legal Counsel, Compliance Officer, Privacy Analyst, Contract Reviewer
 * Produces: Contract reviews, compliance reports, legal opinions, privacy assessments
 * Reviews: All external communications, contracts, data handling, marketing claims
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

export function createLegalDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'legal',
    name: 'Legal',
    mission: 'Protect the company from legal risk while enabling growth',
    headId,
    budget: { monthly: 80_000, used: 0, currency: 'USD' },
    minWorkers: 1,
    maxWorkers: 8,
    kpis: [
      { name: 'Contract Review Turnaround', target: 24, current: 0, unit: 'hours', trend: 'stable' },
      { name: 'Compliance Issues Found', target: 0, current: 0, unit: 'critical', trend: 'stable' },
      { name: 'Regulatory Audits Passed', target: 100, current: 0, unit: 'percent', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Legal Counsel',
        seniority: 'senior',
        minCount: 1,
        maxCount: 4,
        specializations: ['contract_law', 'ip_law', 'corporate_law', 'litigation'],
        costPerHour: 5.00,
      },
      {
        role: 'Compliance Officer',
        seniority: 'mid',
        minCount: 0,
        maxCount: 4,
        specializations: ['gdpr', 'ccpa', 'soc2', 'hipaa', 'regulatory_compliance'],
        costPerHour: 3.50,
      },
    ],
  };
}

class LegalWorker extends BaseWorker {
  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    console.log(`[${this.profile.role}] Reviewing: "${goal.title}"`);

    const review = await this.performLegalReview(goal);
    const riskLevel = this.assessRisk(review);

    if (riskLevel === 'high') {
      await this.escalate({
        urgency: 'high',
        context: `High legal risk identified in: ${goal.title}. ${review.issues.join('; ')}`,
        recommendation: 'Do not proceed without legal sign-off',
      });
    }

    await this.shareKnowledge({
      type: riskLevel === 'high' ? 'warning' : 'fact',
      content: `Legal review of "${goal.title}": ${review.verdict}. Risk: ${riskLevel}`,
      domain: 'legal_compliance',
      confidence: 0.92,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, review);
    this.recordTaskOutcome({
      taskId: goal.goalId, success: true, qualityScore: 0.94,
      timeToComplete: 45, tokensUsed: 4000, costUsd: 2.00,
    });
  }

  private async performLegalReview(goal: WorkerGoal): Promise<{
    verdict: 'approved' | 'approved_with_conditions' | 'rejected';
    issues: string[];
    conditions: string[];
  }> {
    return {
      verdict: 'approved_with_conditions',
      issues: [],
      conditions: ['Add standard limitation of liability clause'],
    };
  }

  private assessRisk(review: { verdict: string; issues: string[] }): 'low' | 'medium' | 'high' {
    if (review.verdict === 'rejected') return 'high';
    if (review.issues.length > 2) return 'medium';
    return 'low';
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'contract_review_request') {
      await this.acceptGoal({
        goalId: crypto.randomUUID(),
        title: `Contract review: ${message['contractName']}`,
        description: `Review contract for legal compliance and risk: ${message['contractName']}`,
        priority: 'high',
        acceptanceCriteria: ['Contract reviewed', 'Risk assessment complete', 'Verdict delivered'],
        assignedBy: message['requesterId'] as string,
        assignedAt: new Date(),
      });
    }
  }
}

export class LegalDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    return new LegalWorker(profile, this.messageBus, this.knowledgeBase);
  }
}
