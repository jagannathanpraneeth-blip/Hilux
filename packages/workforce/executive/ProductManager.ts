/**
 * ProductManager — Chief Product Officer / Head of Product.
 *
 * Owns the product vision, user research, roadmap, and feature prioritization.
 * Works closely with Engineering (via CTO) and Marketing.
 */
import { BaseWorker, WorkerGoal, WorkerProfile } from '../core/worker/BaseWorker.js';
import type { MessageBus } from '../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../core/knowledge/KnowledgeBase.js';

export class ProductManager extends BaseWorker {
  constructor(messageBus: MessageBus, knowledgeBase: KnowledgeBase) {
    const profile: WorkerProfile = {
      workerId: 'exec-cpo-001',
      name: 'CPO',
      role: 'Chief Product Officer',
      department: 'product',
      seniority: 'executive',
      hiredAt: new Date(),
      managerId: 'exec-ceo-001',
      directReports: ['dept-research', 'dept-analytics'],
      specializations: [
        'product_strategy',
        'user_research',
        'roadmap_planning',
        'feature_prioritization',
        'metrics_definition',
        'stakeholder_alignment',
      ],
      autonomyLevel: 'executive',
      status: 'onboarding',
    };
    super(profile, messageBus, knowledgeBase);
  }

  async writePRD(feature: { name: string; userProblem: string; goal: string }): Promise<string> {
    const context = await this.recallContext(feature.userProblem);
    return [
      `# Product Requirements Document: ${feature.name}`,
      `## Problem Statement\n${feature.userProblem}`,
      `## Goal\n${feature.goal}`,
      `## Success Metrics\n- User adoption > 60% within 30 days\n- NPS improvement > 10 points`,
      `## Context from Past Work\n${context.relevantKnowledge.slice(0, 2).join('\n')}`,
      `## Acceptance Criteria\n- Feature works end-to-end\n- Documentation complete\n- Analytics tracking in place`,
    ].join('\n\n');
  }

  async prioritizeRoadmap(features: string[]): Promise<string[]> {
    // RICE scoring framework (Reach, Impact, Confidence, Effort)
    const scored = features.map(f => ({
      feature: f,
      score: Math.random() * 100, // LLM-scored in production
    }));
    return scored.sort((a, b) => b.score - a.score).map(s => s.feature);
  }

  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    const prd = await this.writePRD({
      name: goal.title,
      userProblem: goal.description,
      goal: goal.acceptanceCriteria.join('; '),
    });

    await this.shareKnowledge({
      type: 'procedure',
      content: prd,
      domain: 'product_requirements',
      confidence: 0.85,
    });

    // Notify Engineering with the PRD
    await this.messageBus.publish('department.engineering.directive', {
      type: 'prd_published',
      prd,
      from: this.profile.workerId,
    });

    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { prd });
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'user_feedback') {
      await this.shareKnowledge({
        type: 'learning',
        content: `User feedback: ${message['feedback']}`,
        domain: 'user_research',
        confidence: 0.9,
      });
    }
  }
}
