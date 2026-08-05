/**
 * CEO — Chief Executive Officer of the AI Workforce.
 *
 * The CEO sits at the top of the hierarchy. Their role:
 *
 * 1. Receives goals from the external world (human operators)
 * 2. Decomposes company-level goals into department-level directives
 * 3. Sets KPIs for all departments
 * 4. Runs weekly executive reviews
 * 5. Makes high-stakes autonomous decisions (budget, hiring freezes, pivots)
 * 6. Handles escalations from C-suite (CTO, CPO, COO)
 * 7. Reports org health to human board
 *
 * The CEO never executes tasks directly. They govern.
 */

import { BaseWorker, WorkerGoal } from '../core/worker/BaseWorker.js';
import type { MessageBus } from '../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../core/knowledge/KnowledgeBase.js';
import type { WorkerProfile } from '../core/worker/BaseWorker.js';

export class CEO extends BaseWorker {
  // Department IDs the CEO directly governs
  private readonly directReportDepartments: string[];

  constructor(
    messageBus: MessageBus,
    knowledgeBase: KnowledgeBase,
    directReportDepartments: string[]
  ) {
    const profile: WorkerProfile = {
      workerId: 'exec-ceo-001',
      name: 'CEO',
      role: 'Chief Executive Officer',
      department: 'executive',
      seniority: 'executive',
      hiredAt: new Date(),
      managerId: undefined,   // Reports to no one internally
      directReports: directReportDepartments,
      specializations: [
        'strategic_planning',
        'organizational_design',
        'goal_decomposition',
        'executive_decision_making',
        'stakeholder_management',
      ],
      autonomyLevel: 'executive', // Full autonomy
      status: 'onboarding',
    };

    super(profile, messageBus, knowledgeBase);
    this.directReportDepartments = directReportDepartments;
  }

  // ─────────────────────────────────────────────────────────
  // CEO-SPECIFIC CAPABILITIES
  // ─────────────────────────────────────────────────────────

  /**
   * The primary interface: a human sets a company-level goal.
   * The CEO decomposes it into department directives.
   */
  async setCompanyGoal(goal: {
    title: string;
    description: string;
    priority: WorkerGoal['priority'];
    deadline: Date;
  }): Promise<void> {
    console.log(`\n[CEO] New company goal received: "${goal.title}"`);

    const decomposed = await this.decomposeGoal(goal);

    // Dispatch to relevant departments
    for (const [deptId, deptGoal] of decomposed) {
      await this.messageBus.publish(`department.${deptId}.directive`, {
        type: 'goal_assigned',
        goal: deptGoal,
        from: this.profile.workerId,
        fromRole: 'CEO',
      });
      console.log(`  [CEO] Dispatched to ${deptId}: "${deptGoal.title}"`);
    }

    this.emit('company_goal_dispatched', { goal, decomposed: decomposed.size });
  }

  /**
   * Decompose a company goal into department-level sub-goals.
   * In production: LLM call with organizational context.
   */
  private async decomposeGoal(goal: {
    title: string;
    description: string;
    priority: WorkerGoal['priority'];
    deadline: Date;
  }): Promise<Map<string, WorkerGoal>> {
    const context = await this.recallContext(goal.description);
    const decomposed = new Map<string, WorkerGoal>();

    // Pull relevant past decompositions from memory
    console.log(
      `  [CEO] Recalling context: ${context.pastWork.length} past goals, `+
      `${context.relevantKnowledge.length} knowledge items`
    );

    // Strategic decomposition (LLM in production — stubbed here)
    const subGoals = await this.runGoalDecompositionLLM(goal, context);

    for (const sub of subGoals) {
      decomposed.set(sub.department, {
        goalId: crypto.randomUUID(),
        title: sub.title,
        description: sub.description,
        priority: goal.priority,
        deadline: goal.deadline,
        acceptanceCriteria: sub.acceptanceCriteria,
        assignedBy: this.profile.workerId,
        assignedAt: new Date(),
        progress: 0,
        status: 'pending',
      });
    }

    return decomposed;
  }

  private async runGoalDecompositionLLM(
    goal: { title: string; description: string },
    _context: unknown
  ): Promise<Array<{
    department: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
  }>> {
    // Production: LLM call returning structured JSON
    // Scaffold: rule-based decomposition
    return [
      {
        department: 'product',
        title: `Product strategy for: ${goal.title}`,
        description: `Define product requirements and roadmap for: ${goal.description}`,
        acceptanceCriteria: ['PRD written', 'Roadmap updated', 'Stakeholders aligned'],
      },
      {
        department: 'engineering',
        title: `Engineering plan for: ${goal.title}`,
        description: `Technical design and implementation plan for: ${goal.description}`,
        acceptanceCriteria: ['Tech spec approved', 'Sprint planned', 'Dependencies mapped'],
      },
      {
        department: 'marketing',
        title: `Go-to-market for: ${goal.title}`,
        description: `Marketing strategy and launch plan for: ${goal.description}`,
        acceptanceCriteria: ['Campaign brief drafted', 'Channels identified', 'Timeline set'],
      },
    ];
  }

  /**
   * Run the weekly executive review — assess all departments.
   */
  async runExecutiveReview(): Promise<void> {
    console.log('\n[CEO] Running weekly executive review...');

    for (const deptId of this.directReportDepartments) {
      await this.messageBus.publish(`department.${deptId}.directive`, {
        type: 'performance_review',
        reviewerId: this.profile.workerId,
        reviewType: 'weekly_executive',
      });
    }

    // Reflect on the company's overall direction
    const reflection = await this.reflect('weekly_executive_review', {
      goals: this.goals,
      departments: this.directReportDepartments.length,
    });

    if (reflection.qualityScore < 0.7) {
      // Company is underperforming — make strategic adjustments
      await this.makeStrategicAdjustment(reflection.improvements);
    }
  }

  private async makeStrategicAdjustment(improvements: string[]): Promise<void> {
    for (const improvement of improvements) {
      await this.shareKnowledge({
        type: 'best_practice',
        content: `Strategic adjustment required: ${improvement}`,
        domain: 'executive_strategy',
        confidence: 0.85,
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ABSTRACT IMPLEMENTATION
  // ─────────────────────────────────────────────────────────

  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    // CEO goals are strategic — they decompose and delegate
    await this.setCompanyGoal({
      title: goal.title,
      description: goal.description,
      priority: goal.priority,
      deadline: goal.deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    goal.status = 'completed';
    goal.progress = 100;

    await this.reflect(goal.goalId, { delegated: true });
    await this.rememberTask(goal.goalId, `Delegated: ${goal.title}`, 'success');
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    switch (message['type']) {
      case 'escalation':
        await this.handleExecutiveEscalation(message);
        break;
      case 'department_critical_alert':
        await this.handleCriticalAlert(message);
        break;
    }
  }

  private async handleExecutiveEscalation(escalation: Record<string, unknown>): Promise<void> {
    console.log(
      `[CEO] Escalation from ${escalation['fromRole']}: ${escalation['context']}`
    );

    // Make a decision on the escalation
    const decision = await this.decide(
      escalation['context'] as string,
      [
        { option: 'approve', rationale: 'Default: approve and proceed', risk: 'low', impactLevel: 'moderate' },
        { option: 'reject', rationale: 'Reject and request alternative', risk: 'medium', impactLevel: 'moderate' },
        { option: 'defer', rationale: 'Defer to more information', risk: 'low', impactLevel: 'minor' },
      ]
    );

    // Respond to escalator
    await this.communicate(escalation['workerId'] as string, {
      type: 'escalation_resolved',
      escalationId: escalation['escalationId'],
      resolution: decision.chosen,
      rationale: decision.rationale,
      resolvedAt: new Date(),
    });
  }

  private async handleCriticalAlert(alert: Record<string, unknown>): Promise<void> {
    console.log(`[CEO] CRITICAL ALERT from ${alert['department']}: ${alert['alert']}`);
    this.emit('critical_alert', alert);
  }
}
