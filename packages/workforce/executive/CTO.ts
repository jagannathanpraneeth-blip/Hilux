/**
 * CTO — Chief Technology Officer
 *
 * Owns the technical vision and execution of the AI company.
 * Governs: Engineering, Research, DevOps, Security, QA, Documentation
 *
 * Responsibilities:
 * - Translates business goals into technical architecture
 * - Sets engineering standards and policies
 * - Approves major technical decisions (architecture, stack, infrastructure)
 * - Runs engineering all-hands
 * - Monitors system health and SLAs
 * - Manages technical debt and engineering velocity
 */

import { BaseWorker, WorkerGoal, WorkerProfile } from '../core/worker/BaseWorker.js';
import type { MessageBus } from '../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../core/knowledge/KnowledgeBase.js';

export class CTO extends BaseWorker {
  private readonly governedDepartments = [
    'engineering', 'research', 'devops', 'security', 'qa', 'documentation'
  ];

  constructor(messageBus: MessageBus, knowledgeBase: KnowledgeBase) {
    const profile: WorkerProfile = {
      workerId: 'exec-cto-001',
      name: 'CTO',
      role: 'Chief Technology Officer',
      department: 'executive',
      seniority: 'executive',
      hiredAt: new Date(),
      managerId: 'exec-ceo-001',
      directReports: ['dept-engineering', 'dept-research', 'dept-devops', 'dept-security', 'dept-qa', 'dept-docs'],
      specializations: [
        'system_architecture',
        'engineering_management',
        'technical_strategy',
        'infrastructure_design',
        'security_governance',
        'r&d_leadership',
      ],
      autonomyLevel: 'executive',
      status: 'onboarding',
    };
    super(profile, messageBus, knowledgeBase);
  }

  /** Translate a product/business goal into a technical directive */
  async issueEngineeringDirective(directive: {
    title: string;
    technicalContext: string;
    targetDepartment: string;
    priority: WorkerGoal['priority'];
    deadline: Date;
  }): Promise<void> {
    const techSpec = await this.createTechnicalSpec(directive);

    await this.messageBus.publish(`department.${directive.targetDepartment}.directive`, {
      type: 'goal_assigned',
      goal: {
        goalId: crypto.randomUUID(),
        title: directive.title,
        description: techSpec,
        priority: directive.priority,
        deadline: directive.deadline,
        acceptanceCriteria: ['Implementation complete', 'Tests passing', 'Documentation updated'],
        assignedBy: this.profile.workerId,
        assignedAt: new Date(),
        progress: 0,
        status: 'pending',
      },
      from: this.profile.workerId,
      fromRole: 'CTO',
    });
  }

  private async createTechnicalSpec(directive: {
    title: string;
    technicalContext: string;
  }): Promise<string> {
    const context = await this.recallContext(directive.technicalContext);
    // Production: LLM-generated technical specification
    return `Technical Specification for: ${directive.title}\n\nContext: ${directive.technicalContext}\n\nPast learnings applied: ${context.relevantKnowledge.join('; ')}`;
  }

  async runEngineeringAllHands(): Promise<void> {
    for (const dept of this.governedDepartments) {
      await this.messageBus.publish(`department.${dept}`, {
        type: 'knowledge_broadcast',
        knowledge: 'CTO all-hands: Focus on code quality and velocity this sprint',
        domain: 'engineering_standards',
        contributor: this.profile.role,
      });
    }
  }

  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    await this.issueEngineeringDirective({
      title: goal.title,
      technicalContext: goal.description,
      targetDepartment: 'engineering',
      priority: goal.priority,
      deadline: goal.deadline ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    goal.status = 'completed';
    goal.progress = 100;
    await this.reflect(goal.goalId, { delegated: true });
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'technical_escalation') {
      console.log(`[CTO] Technical escalation: ${message['context']}`);
      await this.decide(
        message['context'] as string,
        [
          { option: 'approve_approach', rationale: 'Technical approach is sound', risk: 'low', impactLevel: 'moderate' },
          { option: 'request_redesign', rationale: 'Architecture needs rethinking', risk: 'medium', impactLevel: 'major' },
        ]
      );
    }
  }
}
