/**
 * Department — A self-managing organizational unit that dynamically hires,
 * supervises, reviews, and terminates workers.
 *
 * A Department behaves like a real business department:
 * - Has a head (department manager)
 * - Has a budget and KPIs
 * - Hires workers when workload exceeds capacity
 * - Reviews performance on a regular schedule
 * - Fires underperformers and replaces with new hires
 * - Promotes high performers to senior roles
 * - Maintains a knowledge base that outlives any individual worker
 * - Communicates with other departments through formal channels
 * - Reports up to executive layer
 */

import { EventEmitter } from 'events';
import type { BaseWorker, WorkerGoal, WorkerProfile } from '../worker/BaseWorker.js';
import { PerformanceTracker } from '../metrics/PerformanceTracker.js';
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js';
import { MessageBus } from '../communication/MessageBus.js';

export interface DepartmentConfig {
  departmentId: string;
  name: string;
  mission: string;
  headId: string;         // Worker ID of department head
  parentDeptId?: string;  // For sub-departments (e.g., Frontend is under Engineering)
  budget: {
    monthly: number;
    used: number;
    currency: 'USD';
  };
  kpis: DepartmentKPI[];
  minWorkers: number;
  maxWorkers: number;
  workerTypes: WorkerTypeConfig[];
}

export interface DepartmentKPI {
  name: string;
  target: number;
  current: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface WorkerTypeConfig {
  role: string;
  seniority: WorkerProfile['seniority'];
  minCount: number;   // Always keep at least this many
  maxCount: number;   // Never exceed this many
  specializations: string[];
  costPerHour: number;
}

export interface WorkforceReport {
  departmentId: string;
  timestamp: Date;
  headCount: number;
  activeWorkers: number;
  idleWorkers: number;
  pendingGoals: number;
  completedGoalsThisWeek: number;
  averagePerformance: number;
  budgetUtilization: number;
  kpiStatus: DepartmentKPI[];
  escalationsPending: number;
  knowledgeItemsAdded: number;
}

export abstract class Department extends EventEmitter {
  public readonly config: DepartmentConfig;
  protected workers: Map<string, BaseWorker> = new Map();
  protected pendingGoals: WorkerGoal[] = [];
  protected readonly knowledgeBase: KnowledgeBase;
  protected readonly messageBus: MessageBus;
  protected readonly metrics: PerformanceTracker;

  // Internal scheduling
  private reviewInterval?: NodeJS.Timeout;
  private capacityCheckInterval?: NodeJS.Timeout;
  private weeklyReportInterval?: NodeJS.Timeout;

  constructor(
    config: DepartmentConfig,
    messageBus: MessageBus,
    knowledgeBase: KnowledgeBase
  ) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.knowledgeBase = knowledgeBase;
    this.metrics = new PerformanceTracker(config.departmentId, config.name);
  }

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    console.log(`[Department] ${this.config.name} initializing...`);

    // Subscribe to incoming directives from executive layer
    this.messageBus.subscribe(
      `department.${this.config.departmentId}.directive`,
      this.handleDirective.bind(this)
    );

    // Subscribe to cross-department requests
    this.messageBus.subscribe(
      `department.${this.config.departmentId}.request`,
      this.handleCrossDeptRequest.bind(this)
    );

    // Hire initial workforce to meet minimum staffing
    await this.ensureMinimumStaffing();

    // Start performance review cycle (every 24 hours in production; configurable)
    this.reviewInterval = setInterval(
      () => this.runPerformanceReview(),
      24 * 60 * 60 * 1000
    );

    // Capacity check every 5 minutes
    this.capacityCheckInterval = setInterval(
      () => this.adjustCapacity(),
      5 * 60 * 1000
    );

    // Weekly workforce report
    this.weeklyReportInterval = setInterval(
      () => this.generateAndSubmitReport(),
      7 * 24 * 60 * 60 * 1000
    );

    this.emit('initialized', { departmentId: this.config.departmentId });
    console.log(`[Department] ${this.config.name} ready with ${this.workers.size} workers`);
  }

  // ─────────────────────────────────────────────────────────
  // DYNAMIC WORKFORCE MANAGEMENT
  // ─────────────────────────────────────────────────────────

  /** Hire a new worker of the specified type */
  async hire(workerType: WorkerTypeConfig, reason: string): Promise<BaseWorker> {
    const workerId = crypto.randomUUID();

    const profile: WorkerProfile = {
      workerId,
      name: `${workerType.role}-${workerId.slice(0, 6)}`,
      role: workerType.role,
      department: this.config.departmentId,
      seniority: workerType.seniority,
      hiredAt: new Date(),
      managerId: this.config.headId,
      directReports: [],
      specializations: workerType.specializations,
      autonomyLevel: workerType.seniority === 'junior' ? 'supervised'
        : workerType.seniority === 'mid' ? 'guided'
        : workerType.seniority === 'senior' ? 'independent'
        : 'executive',
      status: 'onboarding',
    };

    const worker = await this.createWorker(profile);
    this.workers.set(workerId, worker);

    // Set up event listeners for this worker
    this.attachWorkerListeners(worker);

    // Onboard the worker
    await worker.onboard();

    // Assign any pending goals that match this worker's capabilities
    await this.assignPendingGoals(worker);

    this.emit('worker_hired', {
      departmentId: this.config.departmentId,
      workerId,
      role: workerType.role,
      reason,
    });

    console.log(`[${this.config.name}] Hired ${workerType.role} (${workerId.slice(0, 6)}) — reason: ${reason}`);
    return worker;
  }

  /** Fire a worker due to performance or redundancy */
  async fire(workerId: string, reason: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    console.log(`[${this.config.name}] Terminating ${worker.profile.role} (${workerId.slice(0, 6)}) — reason: ${reason}`);

    // Graceful termination (includes knowledge handoff)
    await worker.terminate(reason);

    this.workers.delete(workerId);

    this.emit('worker_fired', {
      departmentId: this.config.departmentId,
      workerId,
      role: worker.profile.role,
      reason,
    });
  }

  /** Promote a worker: increases seniority and autonomy */
  async promote(workerId: string, reason: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    const seniorityLadder: WorkerProfile['seniority'][] = [
      'junior', 'mid', 'senior', 'principal', 'executive'
    ];

    const currentIndex = seniorityLadder.indexOf(worker.profile.seniority);
    if (currentIndex >= seniorityLadder.length - 1) return;

    (worker.profile as { seniority: WorkerProfile['seniority'] }).seniority =
      seniorityLadder[currentIndex + 1];

    await worker.upgradeAutonomy();

    await worker.communicate(worker.profile.workerId, {
      type: 'promotion_notification',
      newSeniority: worker.profile.seniority,
      reason,
    });

    this.emit('worker_promoted', {
      departmentId: this.config.departmentId,
      workerId,
      newSeniority: worker.profile.seniority,
      reason,
    });

    console.log(`[${this.config.name}] Promoted ${worker.profile.role} to ${worker.profile.seniority} — ${reason}`);
  }

  // ─────────────────────────────────────────────────────────
  // GOAL MANAGEMENT
  // ─────────────────────────────────────────────────────────

  /** Receive a goal from executive layer and assign to best-fit worker */
  async receiveGoal(goal: WorkerGoal): Promise<void> {
    this.pendingGoals.push(goal);
    await this.assignGoal(goal);
  }

  private async assignGoal(goal: WorkerGoal): Promise<void> {
    // Find the best available worker for this goal
    const candidate = this.findBestWorkerFor(goal);

    if (!candidate) {
      // No available worker — check if we can hire one
      if (this.workers.size < this.config.maxWorkers) {
        const matchingType = this.config.workerTypes.find(
          wt => this.goalMatchesWorkerType(goal, wt)
        );

        if (matchingType) {
          const newWorker = await this.hire(matchingType, `Capacity demand for: ${goal.title}`);
          await newWorker.acceptGoal(goal);
        } else {
          // Cannot fulfill — escalate
          await this.escalateToCEO({
            issue: `No worker type available for goal: ${goal.title}`,
            goal,
          });
        }
      } else {
        // At capacity — queue goal
        console.log(`[${this.config.name}] Goal queued (at capacity): ${goal.title}`);
      }
      return;
    }

    this.pendingGoals = this.pendingGoals.filter(g => g.goalId !== goal.goalId);
    await candidate.acceptGoal(goal);
  }

  private findBestWorkerFor(goal: WorkerGoal): BaseWorker | null {
    const candidates = [...this.workers.values()].filter(
      w => w.profile.status === 'idle' || w.profile.status === 'working'
    );

    if (candidates.length === 0) return null;

    // Score by: specialization match, performance score, current load
    const scored = candidates.map(w => {
      const perfScore = w.getPerformanceSnapshot().overallScore;
      const currentLoad = w.profile.status === 'working' ? 0.5 : 1.0;
      return { worker: w, score: perfScore * currentLoad };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.worker ?? null;
  }

  private goalMatchesWorkerType(goal: WorkerGoal, type: WorkerTypeConfig): boolean {
    // Simple keyword match — in production: LLM-based matching
    return type.specializations.some(s =>
      goal.description.toLowerCase().includes(s.toLowerCase())
    );
  }

  // ─────────────────────────────────────────────────────────
  // PERFORMANCE REVIEW CYCLE
  // ─────────────────────────────────────────────────────────

  /** Run automated performance review on all workers */
  async runPerformanceReview(): Promise<void> {
    console.log(`[${this.config.name}] Running performance review cycle...`);

    const TERMINATION_THRESHOLD = 0.40;
    const PROMOTION_THRESHOLD = 0.92;
    const IMPROVEMENT_THRESHOLD = 0.65;

    for (const [workerId, worker] of this.workers) {
      const perf = worker.getPerformanceSnapshot();

      if (perf.overallScore < TERMINATION_THRESHOLD) {
        await this.fire(workerId, `Performance below threshold: ${(perf.overallScore * 100).toFixed(0)}%`);
        // Replace immediately
        const type = this.config.workerTypes.find(t => t.role === worker.profile.role);
        if (type) {
          await this.hire(type, 'Performance-based replacement');
        }
      } else if (perf.overallScore > PROMOTION_THRESHOLD && perf.trend === 'improving') {
        await this.promote(workerId, `Exceptional performance: ${(perf.overallScore * 100).toFixed(0)}%`);
      } else if (perf.overallScore < IMPROVEMENT_THRESHOLD) {
        // Trigger improvement cycle
        await worker.runImprovementCycle();
      }
    }

    this.emit('review_complete', {
      departmentId: this.config.departmentId,
      workersReviewed: this.workers.size,
    });
  }

  // ─────────────────────────────────────────────────────────
  // CAPACITY MANAGEMENT
  // ─────────────────────────────────────────────────────────

  /** Dynamically adjust workforce size based on demand */
  async adjustCapacity(): Promise<void> {
    const pendingCount = this.pendingGoals.length;
    const workerCount = this.workers.size;
    const idleCount = [...this.workers.values()].filter(
      w => w.profile.status === 'idle'
    ).length;

    // Scale up: more pending work than idle workers
    if (pendingCount > idleCount && workerCount < this.config.maxWorkers) {
      const deficit = Math.min(
        pendingCount - idleCount,
        this.config.maxWorkers - workerCount
      );

      for (let i = 0; i < deficit; i++) {
        const type = this.config.workerTypes[0];
        if (type) await this.hire(type, 'Capacity scale-up');
      }
    }

    // Scale down: too many idle workers above minimum
    if (idleCount > 2 && workerCount > this.config.minWorkers) {
      const surplus = Math.min(
        idleCount - 2,
        workerCount - this.config.minWorkers
      );

      const idleWorkers = [...this.workers.values()]
        .filter(w => w.profile.status === 'idle')
        .slice(0, surplus);

      for (const worker of idleWorkers) {
        await this.fire(worker.profile.workerId, 'Capacity scale-down');
      }
    }

    await this.ensureMinimumStaffing();
  }

  private async ensureMinimumStaffing(): Promise<void> {
    for (const type of this.config.workerTypes) {
      const existing = [...this.workers.values()].filter(
        w => w.profile.role === type.role
      ).length;

      for (let i = existing; i < type.minCount; i++) {
        await this.hire(type, 'Minimum staffing requirement');
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // REPORTING
  // ─────────────────────────────────────────────────────────

  async generateAndSubmitReport(): Promise<WorkforceReport> {
    const report: WorkforceReport = {
      departmentId: this.config.departmentId,
      timestamp: new Date(),
      headCount: this.workers.size,
      activeWorkers: [...this.workers.values()].filter(w => w.profile.status === 'working').length,
      idleWorkers: [...this.workers.values()].filter(w => w.profile.status === 'idle').length,
      pendingGoals: this.pendingGoals.length,
      completedGoalsThisWeek: 0, // Computed from metrics
      averagePerformance: this.computeAveragePerformance(),
      budgetUtilization: this.config.budget.used / this.config.budget.monthly,
      kpiStatus: this.config.kpis,
      escalationsPending: [...this.workers.values()].reduce(
        (sum, w) => sum + w['pendingEscalations']?.filter(
          (e: { resolvedAt?: Date }) => !e.resolvedAt
        ).length ?? 0, 0
      ),
      knowledgeItemsAdded: 0, // Computed from knowledge base
    };

    // Submit to executive layer
    await this.messageBus.publish('executive.reports', {
      type: 'department_report',
      departmentId: this.config.departmentId,
      departmentName: this.config.name,
      report,
    });

    this.emit('report_submitted', { departmentId: this.config.departmentId, report });
    return report;
  }

  private computeAveragePerformance(): number {
    if (this.workers.size === 0) return 0;
    const total = [...this.workers.values()].reduce(
      (sum, w) => sum + w.getPerformanceSnapshot().overallScore, 0
    );
    return total / this.workers.size;
  }

  // ─────────────────────────────────────────────────────────
  // COMMUNICATION
  // ─────────────────────────────────────────────────────────

  protected async handleDirective(directive: Record<string, unknown>): Promise<void> {
    if (directive['type'] === 'goal_assigned') {
      await this.receiveGoal(directive['goal'] as WorkerGoal);
    }
  }

  protected async handleCrossDeptRequest(request: Record<string, unknown>): Promise<void> {
    // Subclasses handle domain-specific cross-department requests
    this.emit('cross_dept_request', request);
  }

  async requestFromDepartment(
    targetDeptId: string,
    request: Record<string, unknown>
  ): Promise<void> {
    await this.messageBus.publish(`department.${targetDeptId}.request`, {
      from: this.config.departmentId,
      fromName: this.config.name,
      timestamp: new Date(),
      ...request,
    });
  }

  protected async escalateToCEO(issue: Record<string, unknown>): Promise<void> {
    await this.messageBus.publish('executive.ceo.escalation', {
      from: this.config.departmentId,
      fromName: this.config.name,
      timestamp: new Date(),
      ...issue,
    });
  }

  // ─────────────────────────────────────────────────────────
  // ABSTRACT — Subclasses define their worker type
  // ─────────────────────────────────────────────────────────

  protected abstract createWorker(profile: WorkerProfile): Promise<BaseWorker>;

  // ─────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────

  private attachWorkerListeners(worker: BaseWorker): void {
    worker.on('escalated', async (event) => {
      // Department head handles worker escalations
      const head = this.workers.get(this.config.headId);
      if (head) {
        await head.communicate(head.profile.workerId, {
          type: 'worker_escalation',
          ...event,
        });
      }
    });

    worker.on('terminated', (event) => {
      this.workers.delete(event.workerId);
      this.emit('worker_left', event);
    });

    worker.on('knowledge_shared', async (event) => {
      // Re-broadcast to all other workers in department
      for (const [id, peer] of this.workers) {
        if (id !== event.workerId) {
          await peer.communicate(id, {
            type: 'knowledge_shared',
            knowledge: event.knowledge,
          });
        }
      }
    });

    worker.on('metrics_updated', (event) => {
      this.emit('worker_metrics_updated', event);
    });
  }
}
