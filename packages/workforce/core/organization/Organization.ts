/**
 * Organization — The top-level AI company.
 *
 * This is the entity that behaves like a real corporation.
 * It contains the executive layer, all departments, org-wide memory,
 * company-wide communication infrastructure, and governance.
 *
 * Responsibilities:
 * - Instantiate and manage all 18 departments
 * - Route goals from CEO down through the hierarchy
 * - Maintain org-wide knowledge base
 * - Run company-wide performance reviews
 * - Track org-level KPIs and financial health
 * - Enforce company values and policies across all workers
 */

import { EventEmitter } from 'events';
import { MessageBus } from '../communication/MessageBus.js';
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js';
import type { Department, WorkforceReport } from '../department/Department.js';
import type { WorkerGoal } from '../worker/BaseWorker.js';

export interface OrganizationConfig {
  name: string;
  mission: string;
  values: string[];
  annualBudget: number;
  currency: 'USD';
}

export interface OrgGoal {
  goalId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline: Date;
  ownerDepartment: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  subGoals: WorkerGoal[];
}

export interface OrgHealthReport {
  timestamp: Date;
  totalWorkers: number;
  totalDepartments: number;
  activeGoals: number;
  completedGoalsThisMonth: number;
  averageWorkerPerformance: number;
  budgetUtilization: number;
  knowledgeBaseSize: number;
  escalationsPending: number;
  departmentReports: WorkforceReport[];
}

export class Organization extends EventEmitter {
  public readonly config: OrganizationConfig;
  private readonly messageBus: MessageBus;
  private readonly knowledgeBase: KnowledgeBase;
  private readonly departments: Map<string, Department> = new Map();
  private orgGoals: OrgGoal[] = [];
  private departmentReports: Map<string, WorkforceReport> = new Map();

  constructor(config: OrganizationConfig) {
    super();
    this.config = config;
    this.messageBus = new MessageBus();
    this.knowledgeBase = new KnowledgeBase(`org:${config.name}`);
  }

  // ─────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  HILUX AI WORKFORCE BOOTING`);
    console.log(`  Company: ${this.config.name}`);
    console.log(`  Mission: ${this.config.mission}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Seed org-wide knowledge with company values and policies
    await this.seedOrganizationalKnowledge();

    // Initialize all departments
    for (const [deptId, dept] of this.departments) {
      console.log(`  Starting department: ${dept.config.name}...`);
      await dept.initialize();
    }

    // Subscribe to department reports
    this.messageBus.subscribe('executive.reports', this.handleDepartmentReport.bind(this));

    // Subscribe to cross-cutting escalations
    this.messageBus.subscribe('executive.ceo.escalation', this.handleCEOEscalation.bind(this));

    // Start org-level health check (hourly)
    setInterval(() => this.runHealthCheck(), 60 * 60 * 1000);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  WORKFORCE ACTIVE`);
    console.log(`  Departments: ${this.departments.size}`);
    console.log(`  Total Workers: ${this.getTotalWorkerCount()}`);
    console.log(`${'═'.repeat(60)}\n`);

    this.emit('organization_booted', {
      name: this.config.name,
      departments: this.departments.size,
      workers: this.getTotalWorkerCount(),
    });
  }

  // ─────────────────────────────────────────────────────────
  // DEPARTMENT MANAGEMENT
  // ─────────────────────────────────────────────────────────

  registerDepartment(department: Department): void {
    this.departments.set(department.config.departmentId, department);

    // Listen for department events
    department.on('worker_hired', (e) => this.emit('worker_hired', e));
    department.on('worker_fired', (e) => this.emit('worker_fired', e));
    department.on('worker_promoted', (e) => this.emit('worker_promoted', e));
    department.on('report_submitted', async (e) => {
      const report = await department.generateAndSubmitReport();
      this.departmentReports.set(e.departmentId, report);
    });
  }

  getDepartment(departmentId: string): Department | undefined {
    return this.departments.get(departmentId);
  }

  // ─────────────────────────────────────────────────────────
  // GOAL MANAGEMENT
  // ─────────────────────────────────────────────────────────

  /**
   * The primary entry point: a human (or the CEO) sets a company goal.
   * The org decomposes it, routes it to the right department(s), and tracks it.
   */
  async setGoal(goal: OrgGoal): Promise<void> {
    this.orgGoals.push(goal);
    this.emit('org_goal_set', goal);

    const targetDept = this.departments.get(goal.ownerDepartment);
    if (!targetDept) {
      console.error(`[Org] No department found for: ${goal.ownerDepartment}`);
      return;
    }

    // Dispatch sub-goals to owning department
    for (const subGoal of goal.subGoals) {
      await targetDept.receiveGoal(subGoal);
    }

    console.log(
      `[${this.config.name}] Goal dispatched to ${targetDept.config.name}: "${goal.title}"`
    );
  }

  // ─────────────────────────────────────────────────────────
  // KNOWLEDGE
  // ─────────────────────────────────────────────────────────

  private async seedOrganizationalKnowledge(): Promise<void> {
    const orgPolicies = [
      `Company mission: ${this.config.mission}`,
      `Company values: ${this.config.values.join(', ')}`,
      'All workers must reflect after every task completion',
      'Escalation to manager when confidence < 0.70 on major decisions',
      'Knowledge must be shared with department after every significant learning',
      'Performance reviews are automated and objective — based on measurable metrics only',
      'Worker autonomy increases with demonstrated performance above 90% for 30 consecutive days',
    ];

    for (const policy of orgPolicies) {
      await this.knowledgeBase.store({
        type: 'fact',
        content: policy,
        domain: 'organizational_policy',
        confidence: 1.0,
        contributor: 'organization',
        contributorRole: 'system',
        department: 'org',
        timestamp: new Date(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // HEALTH & REPORTING
  // ─────────────────────────────────────────────────────────

  async runHealthCheck(): Promise<OrgHealthReport> {
    const reports = [...this.departmentReports.values()];

    const report: OrgHealthReport = {
      timestamp: new Date(),
      totalWorkers: this.getTotalWorkerCount(),
      totalDepartments: this.departments.size,
      activeGoals: this.orgGoals.filter(g => g.status === 'active').length,
      completedGoalsThisMonth: this.orgGoals.filter(g => g.status === 'completed').length,
      averageWorkerPerformance: reports.reduce((s, r) => s + r.averagePerformance, 0) / (reports.length || 1),
      budgetUtilization: reports.reduce((s, r) => s + r.budgetUtilization, 0) / (reports.length || 1),
      knowledgeBaseSize: await this.knowledgeBase.size(),
      escalationsPending: reports.reduce((s, r) => s + r.escalationsPending, 0),
      departmentReports: reports,
    };

    this.emit('health_check', report);
    return report;
  }

  private getTotalWorkerCount(): number {
    return [...this.departments.values()].reduce(
      (sum, dept) => sum + dept['workers'].size, 0
    );
  }

  private async handleDepartmentReport(message: Record<string, unknown>): Promise<void> {
    const report = message['report'] as WorkforceReport;
    this.departmentReports.set(message['departmentId'] as string, report);
    this.emit('department_report_received', { departmentId: message['departmentId'], report });
  }

  private async handleCEOEscalation(escalation: Record<string, unknown>): Promise<void> {
    this.emit('ceo_escalation_received', escalation);
    // In production: CEO agent handles this
    console.log(`[${this.config.name}] CEO escalation from ${escalation['fromName']}: ${escalation['issue']}`);
  }

  // Expose for SDK/API use
  getMessageBus(): MessageBus { return this.messageBus; }
  getKnowledgeBase(): KnowledgeBase { return this.knowledgeBase; }
}
