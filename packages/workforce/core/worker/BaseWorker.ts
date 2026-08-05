/**
 * BaseWorker — The foundational class for every member of the AI Workforce.
 *
 * This is not an agent. This is an EMPLOYEE.
 *
 * Every worker in the AI company inherits from this class.
 * It implements all 13 workforce capabilities that make the
 * difference between an agent pool and an actual organization:
 *
 *  1.  Goals              — Current objectives with priority and deadlines
 *  2.  Memory             — Multi-tier cognitive memory (working/episodic/semantic/procedural)
 *  3.  Reflection         — Structured self-assessment after every task
 *  4.  Learning           — Extracting durable lessons from experience
 *  5.  Performance Metrics — Real-time KPI tracking and historical trends
 *  6.  Communication      — Formal up/down/lateral messaging protocol
 *  7.  Autonomy           — Earned decision authority (starts constrained, expands with perf)
 *  8.  Decision Making    — Structured reasoning with confidence and rationale
 *  9.  Self-Improvement   — Active skill gap identification and improvement plans
 *  10. Escalation         — Chain-of-command escalation with proper context
 *  11. Termination        — Graceful shutdown with knowledge handoff
 *  12. Recovery           — Failure detection and self-restoration
 *  13. Knowledge Sharing  — Contribution to department and org knowledge base
 */

import { EventEmitter } from 'events';
import { WorkerMemory } from '../memory/WorkerMemory.js';
import { PerformanceTracker } from '../metrics/PerformanceTracker.js';
import { MessageBus } from '../communication/MessageBus.js';
import { DecisionEngine } from '../decision/DecisionEngine.js';
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkerStatus =
  | 'onboarding'    // Just hired, loading context
  | 'idle'          // Available for work
  | 'working'       // Actively executing a task
  | 'blocked'       // Waiting on dependency/input
  | 'reflecting'    // Post-task reflection cycle
  | 'learning'      // Actively processing learnings
  | 'escalating'    // Waiting for manager response
  | 'recovering'    // Recovering from a failure
  | 'on_leave'      // Temporarily inactive
  | 'terminated';   // No longer active

export type AutonomyLevel =
  | 'supervised'    // All decisions require manager approval
  | 'guided'        // Major decisions need approval, minor are autonomous
  | 'independent'   // Most decisions autonomous, escalate only for high-impact
  | 'executive';    // Full autonomy within budget/policy constraints

export interface WorkerGoal {
  goalId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline?: Date;
  acceptanceCriteria: string[];
  assignedBy: string; // workerId of assigner
  assignedAt: Date;
  progress: number;   // 0-100
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
}

export interface WorkerDecision {
  decisionId: string;
  question: string;
  options: Array<{ option: string; rationale: string; risk: string }>;
  chosen: string;
  confidence: number;    // 0-1
  rationale: string;
  escalated: boolean;    // True if escalated instead of self-decided
  timestamp: Date;
}

export interface ReflectionReport {
  taskId: string;
  qualityScore: number;       // 0-1: how good was the output?
  efficiencyScore: number;    // 0-1: how efficient was the process?
  learnings: string[];        // What was learned
  improvements: string[];     // What to do differently next time
  blockers: string[];         // What got in the way
  timestamp: Date;
}

export interface ImprovementPlan {
  planId: string;
  skillGap: string;
  currentLevel: number;   // 0-1
  targetLevel: number;    // 0-1
  actions: string[];
  deadline: Date;
  progress: number;       // 0-100
}

export interface EscalationRequest {
  escalationId: string;
  workerId: string;
  workerRole: string;
  targetManagerId: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  context: string;
  blockedTask?: string;
  recommendation?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface WorkerProfile {
  workerId: string;
  name: string;
  role: string;
  department: string;
  seniority: 'junior' | 'mid' | 'senior' | 'principal' | 'executive';
  hiredAt: Date;
  managerId?: string;
  directReports: string[];
  specializations: string[];
  autonomyLevel: AutonomyLevel;
  status: WorkerStatus;
}

// ─── BaseWorker ───────────────────────────────────────────────────────────────

export abstract class BaseWorker extends EventEmitter {
  // Identity
  public readonly profile: WorkerProfile;

  // Core capabilities
  protected readonly memory: WorkerMemory;
  protected readonly metrics: PerformanceTracker;
  protected readonly messageBus: MessageBus;
  protected readonly decisionEngine: DecisionEngine;
  protected readonly knowledgeBase: KnowledgeBase;

  // Current state
  protected goals: WorkerGoal[] = [];
  protected status: WorkerStatus = 'onboarding';
  protected activeTaskId?: string;
  protected pendingEscalations: EscalationRequest[] = [];
  protected improvementPlans: ImprovementPlan[] = [];
  protected reflectionHistory: ReflectionReport[] = [];

  // Runtime state
  private heartbeatInterval?: NodeJS.Timeout;
  private recoveryAttempts = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  constructor(
    profile: WorkerProfile,
    messageBus: MessageBus,
    knowledgeBase: KnowledgeBase
  ) {
    super();
    this.profile = profile;
    this.messageBus = messageBus;
    this.knowledgeBase = knowledgeBase;
    this.memory = new WorkerMemory(profile.workerId, profile.department);
    this.metrics = new PerformanceTracker(profile.workerId, profile.role);
    this.decisionEngine = new DecisionEngine(profile.workerId, profile.autonomyLevel);
  }

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  /** Start the worker: load context, subscribe to messages, begin heartbeat */
  async onboard(): Promise<void> {
    this.status = 'onboarding';
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });

    // Load organizational context into memory
    await this.memory.loadOrganizationalContext(this.profile.department);

    // Load relevant knowledge from knowledge base
    const relevantKnowledge = await this.knowledgeBase.retrieve(
      this.profile.specializations
    );
    await this.memory.seedFromKnowledge(relevantKnowledge);

    // Subscribe to incoming messages
    this.messageBus.subscribe(
      `worker.${this.profile.workerId}`,
      this.handleMessage.bind(this)
    );

    // Subscribe to department broadcasts
    this.messageBus.subscribe(
      `department.${this.profile.department}`,
      this.handleDepartmentMessage.bind(this)
    );

    // Start heartbeat (detect if worker goes unresponsive)
    this.heartbeatInterval = setInterval(
      () => this.heartbeat(),
      30_000
    );

    this.status = 'idle';
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });
    this.emit('worker_ready', { workerId: this.profile.workerId, role: this.profile.role });

    console.log(`[${this.profile.role}:${this.profile.workerId}] Onboarded and ready`);
  }

  // ─────────────────────────────────────────────────────────
  // 1. GOALS
  // ─────────────────────────────────────────────────────────

  /** Accept a new goal assigned by manager */
  async acceptGoal(goal: Omit<WorkerGoal, 'progress' | 'status'>): Promise<void> {
    const fullGoal: WorkerGoal = { ...goal, progress: 0, status: 'pending' };
    this.goals.push(fullGoal);

    // Store in memory for context
    await this.memory.storeGoal(fullGoal);

    // Acknowledge to assigner
    await this.communicate(goal.assignedBy, {
      type: 'goal_acknowledged',
      goalId: goal.goalId,
      workerId: this.profile.workerId,
      message: `Goal "${goal.title}" accepted. Will begin work as capacity allows.`
    });

    this.emit('goal_accepted', { workerId: this.profile.workerId, goal: fullGoal });

    // If idle, immediately start working on highest-priority goal
    if (this.status === 'idle') {
      await this.startNextGoal();
    }
  }

  /** Determine and start work on the highest-priority pending goal */
  protected async startNextGoal(): Promise<void> {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pending = this.goals
      .filter(g => g.status === 'pending')
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    if (pending.length === 0) return;

    const goal = pending[0];
    goal.status = 'active';
    this.status = 'working';
    this.activeTaskId = goal.goalId;

    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });

    try {
      await this.executeGoal(goal);
    } catch (err) {
      await this.recover(goal.goalId, String(err));
    }
  }

  /** Abstract: each worker type implements their specific work */
  protected abstract executeGoal(goal: WorkerGoal): Promise<void>;

  // ─────────────────────────────────────────────────────────
  // 2. MEMORY
  // ─────────────────────────────────────────────────────────

  /** Retrieve relevant memories for current task */
  protected async recallContext(taskDescription: string): Promise<{
    pastWork: string[];
    relevantKnowledge: string[];
    applicableSkills: string[];
  }> {
    return this.memory.recallForTask(taskDescription);
  }

  /** Store a completed task in memory */
  protected async rememberTask(taskId: string, summary: string, outcome: 'success' | 'failure'): Promise<void> {
    await this.memory.storeTaskOutcome(taskId, summary, outcome);
  }

  // ─────────────────────────────────────────────────────────
  // 3. REFLECTION
  // ─────────────────────────────────────────────────────────

  /** Structured reflection after every completed task */
  async reflect(taskId: string, taskOutput: unknown): Promise<ReflectionReport> {
    const previousStatus = this.status;
    this.status = 'reflecting';
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });

    const context = await this.memory.recallForTask(taskId);
    const goal = this.goals.find(g => g.goalId === taskId);

    // LLM-based structured reflection
    const reflection = await this.performReflection({
      taskId,
      taskOutput,
      goal,
      context,
      myRole: this.profile.role,
      mySpecializations: this.profile.specializations,
    });

    this.reflectionHistory.push(reflection);

    // Feed reflection into metrics
    this.metrics.recordReflection(reflection);

    // Extract learnings for the learning cycle
    await this.learn(reflection.learnings, reflection.improvements);

    this.status = previousStatus;
    this.emit('reflection_complete', {
      workerId: this.profile.workerId,
      taskId,
      qualityScore: reflection.qualityScore,
    });

    return reflection;
  }

  /** Perform the actual reflection reasoning (LLM call in production) */
  protected async performReflection(context: {
    taskId: string;
    taskOutput: unknown;
    goal?: WorkerGoal;
    context: unknown;
    myRole: string;
    mySpecializations: string[];
  }): Promise<ReflectionReport> {
    // In production: LLM call with structured output
    // Stub implementation for architecture demonstration
    return {
      taskId: context.taskId,
      qualityScore: 0.85,
      efficiencyScore: 0.80,
      learnings: [
        'Breaking complex tasks into sub-steps reduces error rate',
        'Consulting knowledge base before starting saves 20% of time'
      ],
      improvements: [
        'Start with context retrieval before planning',
        'Validate intermediate outputs more frequently'
      ],
      blockers: [],
      timestamp: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────
  // 4. LEARNING
  // ─────────────────────────────────────────────────────────

  /** Extract durable lessons and update worker's procedural memory */
  async learn(learnings: string[], improvements: string[]): Promise<void> {
    this.status = 'learning';
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });

    for (const learning of learnings) {
      // Store in procedural memory
      await this.memory.storeLearning(learning, this.profile.specializations);

      // Share with department knowledge base
      await this.shareKnowledge({
        type: 'learning',
        content: learning,
        domain: this.profile.specializations[0] ?? this.profile.department,
        confidence: 0.8,
        sourceTaskId: this.activeTaskId,
      });
    }

    // Update improvement plans based on identified gaps
    for (const improvement of improvements) {
      await this.updateImprovementPlan(improvement);
    }

    this.status = 'idle';
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });
    this.emit('learning_cycle_complete', {
      workerId: this.profile.workerId,
      learnings: learnings.length,
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. PERFORMANCE METRICS
  // ─────────────────────────────────────────────────────────

  /** Get current performance snapshot */
  getPerformanceSnapshot(): {
    overallScore: number;
    taskCompletionRate: number;
    averageQualityScore: number;
    averageEfficiencyScore: number;
    escalationRate: number;
    learningVelocity: number;
    autonomyScore: number;
    trend: 'improving' | 'stable' | 'declining';
  } {
    return this.metrics.getSnapshot();
  }

  /** Record task completion outcome */
  protected recordTaskOutcome(outcome: {
    taskId: string;
    success: boolean;
    qualityScore: number;
    timeToComplete: number;
    tokensUsed: number;
    costUsd: number;
  }): void {
    this.metrics.recordTaskOutcome(outcome);
    this.emit('metrics_updated', {
      workerId: this.profile.workerId,
      metrics: this.getPerformanceSnapshot(),
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. COMMUNICATION
  // ─────────────────────────────────────────────────────────

  /** Send a message to another worker or broadcast to department */
  async communicate(
    targetId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    const envelope = {
      from: this.profile.workerId,
      fromRole: this.profile.role,
      fromDepartment: this.profile.department,
      to: targetId,
      timestamp: new Date(),
      messageId: crypto.randomUUID(),
      ...message,
    };

    await this.messageBus.publish(`worker.${targetId}`, envelope);
    await this.memory.storeMessage('sent', envelope);
  }

  /** Broadcast to entire department */
  async broadcastToDepartment(message: Record<string, unknown>): Promise<void> {
    await this.messageBus.publish(`department.${this.profile.department}`, {
      from: this.profile.workerId,
      fromRole: this.profile.role,
      timestamp: new Date(),
      ...message,
    });
  }

  /** Handle incoming messages */
  protected async handleMessage(message: Record<string, unknown>): Promise<void> {
    await this.memory.storeMessage('received', message);

    switch (message['type']) {
      case 'goal_assigned':
        await this.acceptGoal(message['goal'] as WorkerGoal);
        break;
      case 'escalation_resolved':
        await this.handleEscalationResolution(message as EscalationRequest);
        break;
      case 'performance_review':
        await this.handlePerformanceReview(message);
        break;
      case 'knowledge_shared':
        await this.memory.absorb(message['knowledge'] as string);
        break;
      case 'terminate':
        await this.terminate(message['reason'] as string);
        break;
      default:
        await this.handleCustomMessage(message);
    }
  }

  protected async handleDepartmentMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'knowledge_broadcast') {
      await this.memory.absorb(message['knowledge'] as string);
    }
  }

  /** Subclasses handle domain-specific messages */
  protected abstract handleCustomMessage(message: Record<string, unknown>): Promise<void>;

  // ─────────────────────────────────────────────────────────
  // 7. AUTONOMY
  // ─────────────────────────────────────────────────────────

  /** Check if worker can make a decision autonomously at this impact level */
  canDecideAutonomously(
    impactLevel: 'trivial' | 'minor' | 'moderate' | 'major' | 'critical'
  ): boolean {
    const autonomyMatrix: Record<AutonomyLevel, string[]> = {
      supervised: ['trivial'],
      guided: ['trivial', 'minor'],
      independent: ['trivial', 'minor', 'moderate'],
      executive: ['trivial', 'minor', 'moderate', 'major'],
    };

    return autonomyMatrix[this.profile.autonomyLevel].includes(impactLevel);
  }

  /** Autonomy level can increase through strong performance */
  async upgradeAutonomy(): Promise<boolean> {
    const autonomyLevels: AutonomyLevel[] = ['supervised', 'guided', 'independent', 'executive'];
    const currentIndex = autonomyLevels.indexOf(this.profile.autonomyLevel);

    if (currentIndex >= autonomyLevels.length - 1) return false;

    (this.profile as { autonomyLevel: AutonomyLevel }).autonomyLevel = autonomyLevels[currentIndex + 1];
    this.decisionEngine.setAutonomyLevel(this.profile.autonomyLevel);

    this.emit('autonomy_upgraded', {
      workerId: this.profile.workerId,
      newLevel: this.profile.autonomyLevel,
    });

    return true;
  }

  // ─────────────────────────────────────────────────────────
  // 8. DECISION MAKING
  // ─────────────────────────────────────────────────────────

  /** Make a structured decision, escalating if necessary */
  async decide(question: string, options: Array<{
    option: string;
    rationale: string;
    risk: 'low' | 'medium' | 'high';
    impactLevel: 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
  }>): Promise<WorkerDecision> {
    const decision = await this.decisionEngine.evaluate(question, options);

    // Check if we can make this autonomously
    const highestImpact = options.reduce((max, opt) => {
      const order = { trivial: 0, minor: 1, moderate: 2, major: 3, critical: 4 };
      return order[opt.impactLevel] > order[max] ? opt.impactLevel : max;
    }, 'trivial' as typeof options[0]['impactLevel']);

    if (!this.canDecideAutonomously(highestImpact) || decision.confidence < 0.7) {
      // Must escalate this decision
      await this.escalate({
        urgency: highestImpact === 'critical' ? 'critical' : 'medium',
        context: `Decision required: ${question}`,
        recommendation: decision.chosen,
      });
      decision.escalated = true;
    }

    // Record decision in memory
    await this.memory.storeDecision(decision);

    this.emit('decision_made', {
      workerId: this.profile.workerId,
      decision,
    });

    return decision;
  }

  // ─────────────────────────────────────────────────────────
  // 9. SELF-IMPROVEMENT
  // ─────────────────────────────────────────────────────────

  /** Generate an improvement plan from identified skill gaps */
  protected async updateImprovementPlan(improvement: string): Promise<void> {
    const plan: ImprovementPlan = {
      planId: crypto.randomUUID(),
      skillGap: improvement,
      currentLevel: 0.6,
      targetLevel: 0.9,
      actions: [
        `Study past ${this.profile.department} knowledge base entries on this topic`,
        `Apply improved approach on next 3 similar tasks`,
        `Request feedback from manager after applying`,
      ],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      progress: 0,
    };

    this.improvementPlans.push(plan);

    // Store in memory so future task planning incorporates it
    await this.memory.storeImprovementPlan(plan);

    this.emit('improvement_plan_created', {
      workerId: this.profile.workerId,
      plan,
    });
  }

  /** Run weekly self-improvement cycle */
  async runImprovementCycle(): Promise<void> {
    const perf = this.getPerformanceSnapshot();

    // Identify weakest dimension
    const dimensions = {
      quality: perf.averageQualityScore,
      efficiency: perf.averageEfficiencyScore,
      escalation: 1 - perf.escalationRate,
    };

    const weakest = Object.entries(dimensions)
      .sort(([, a], [, b]) => a - b)[0];

    if (weakest && weakest[1] < 0.75) {
      await this.updateImprovementPlan(
        `Improve ${weakest[0]} from ${(weakest[1] * 100).toFixed(0)}% to 85%+`
      );
    }

    // Check if ready for autonomy upgrade
    if (perf.overallScore > 0.90 && perf.trend === 'improving') {
      await this.upgradeAutonomy();
    }
  }

  // ─────────────────────────────────────────────────────────
  // 10. ESCALATION
  // ─────────────────────────────────────────────────────────

  /** Escalate a blocker or decision to direct manager */
  async escalate(params: {
    urgency: EscalationRequest['urgency'];
    context: string;
    blockedTask?: string;
    recommendation?: string;
  }): Promise<string> {
    if (!this.profile.managerId) {
      // CEO or top-level — log but cannot escalate further
      this.emit('top_level_escalation', { workerId: this.profile.workerId, ...params });
      return 'no_manager';
    }

    const escalation: EscalationRequest = {
      escalationId: crypto.randomUUID(),
      workerId: this.profile.workerId,
      workerRole: this.profile.role,
      targetManagerId: this.profile.managerId,
      urgency: params.urgency,
      context: params.context,
      blockedTask: params.blockedTask,
      recommendation: params.recommendation,
      createdAt: new Date(),
    };

    this.pendingEscalations.push(escalation);
    this.metrics.recordEscalation(escalation);

    const previousStatus = this.status;
    if (params.blockedTask) {
      this.status = 'escalating';
      this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });
    }

    await this.communicate(this.profile.managerId, {
      type: 'escalation',
      escalation,
    });

    this.emit('escalated', { workerId: this.profile.workerId, escalation });

    return escalation.escalationId;
  }

  protected async handleEscalationResolution(resolution: EscalationRequest): Promise<void> {
    const pending = this.pendingEscalations.find(
      e => e.escalationId === resolution.escalationId
    );

    if (pending) {
      pending.resolvedAt = resolution.resolvedAt;
      pending.resolution = resolution.resolution;
    }

    // Resume work if was blocked
    if (this.status === 'escalating') {
      this.status = 'idle';
      this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });
      await this.startNextGoal();
    }

    this.emit('escalation_resolved', { workerId: this.profile.workerId, resolution });
  }

  // ─────────────────────────────────────────────────────────
  // 11. TERMINATION
  // ─────────────────────────────────────────────────────────

  /** Graceful termination with full knowledge handoff */
  async terminate(reason: string): Promise<void> {
    console.log(`[${this.profile.role}:${this.profile.workerId}] Terminating: ${reason}`);

    // 1. Complete or hand off current work
    if (this.activeTaskId) {
      const activeGoal = this.goals.find(g => g.goalId === this.activeTaskId);
      if (activeGoal) {
        await this.handoffGoal(activeGoal, reason);
      }
    }

    // 2. Knowledge handoff — dump all worker memory to department knowledge base
    await this.performKnowledgeHandoff();

    // 3. Write termination report
    const report = await this.writeTerminationReport(reason);

    // 4. Notify manager
    if (this.profile.managerId) {
      await this.communicate(this.profile.managerId, {
        type: 'worker_terminated',
        workerId: this.profile.workerId,
        role: this.profile.role,
        reason,
        report,
      });
    }

    // 5. Unsubscribe from all channels
    this.messageBus.unsubscribe(`worker.${this.profile.workerId}`);
    this.messageBus.unsubscribe(`department.${this.profile.department}`);

    // 6. Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.status = 'terminated';
    this.emit('terminated', {
      workerId: this.profile.workerId,
      role: this.profile.role,
      reason,
    });
  }

  private async handoffGoal(goal: WorkerGoal, terminationReason: string): Promise<void> {
    // Notify department for reassignment
    await this.broadcastToDepartment({
      type: 'goal_needs_reassignment',
      goal,
      fromWorker: this.profile.workerId,
      reason: terminationReason,
      currentProgress: goal.progress,
      context: await this.memory.exportCurrentWorkContext(goal.goalId),
    });
  }

  private async performKnowledgeHandoff(): Promise<void> {
    const allKnowledge = await this.memory.exportAll();

    await this.knowledgeBase.bulkStore(
      allKnowledge.map(k => ({
        ...k,
        source: `worker:${this.profile.workerId}:${this.profile.role}`,
        preservedAt: new Date(),
      }))
    );
  }

  private async writeTerminationReport(reason: string): Promise<Record<string, unknown>> {
    return {
      workerId: this.profile.workerId,
      role: this.profile.role,
      department: this.profile.department,
      tenure: Date.now() - this.profile.hiredAt.getTime(),
      reason,
      finalMetrics: this.getPerformanceSnapshot(),
      goalsCompleted: this.goals.filter(g => g.status === 'completed').length,
      goalsFailed: this.goals.filter(g => g.status === 'failed').length,
      reflections: this.reflectionHistory.length,
      improvementPlans: this.improvementPlans.length,
      escalations: this.pendingEscalations.length,
    };
  }

  // ─────────────────────────────────────────────────────────
  // 12. RECOVERY
  // ─────────────────────────────────────────────────────────

  /** Attempt to recover from a failure */
  async recover(taskId: string, errorDescription: string): Promise<boolean> {
    this.status = 'recovering';
    this.recoveryAttempts++;
    this.emit('status_changed', { workerId: this.profile.workerId, status: this.status });
    this.emit('recovery_started', { workerId: this.profile.workerId, taskId, errorDescription });

    if (this.recoveryAttempts > this.MAX_RECOVERY_ATTEMPTS) {
      // Cannot recover — escalate and await manager decision
      await this.escalate({
        urgency: 'high',
        context: `Failed to recover after ${this.MAX_RECOVERY_ATTEMPTS} attempts: ${errorDescription}`,
        blockedTask: taskId,
      });
      this.recoveryAttempts = 0;
      return false;
    }

    try {
      // Recovery strategy 1: Reset working memory and retry with more context
      await this.memory.resetWorkingContext(taskId);
      const additionalContext = await this.knowledgeBase.retrieveForError(errorDescription);
      await this.memory.inject(additionalContext);

      const goal = this.goals.find(g => g.goalId === taskId);
      if (goal) {
        this.status = 'working';
        await this.executeGoal(goal);
        this.recoveryAttempts = 0;
        this.emit('recovery_succeeded', { workerId: this.profile.workerId, taskId });
        return true;
      }
    } catch (retryError) {
      // Recovery failed — try next strategy
      await this.recover(taskId, String(retryError));
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────
  // 13. KNOWLEDGE SHARING
  // ─────────────────────────────────────────────────────────

  /** Share a piece of knowledge with the department/org knowledge base */
  async shareKnowledge(knowledge: {
    type: 'learning' | 'procedure' | 'fact' | 'warning' | 'best_practice';
    content: string;
    domain: string;
    confidence: number;
    sourceTaskId?: string;
  }): Promise<void> {
    await this.knowledgeBase.store({
      ...knowledge,
      contributor: this.profile.workerId,
      contributorRole: this.profile.role,
      department: this.profile.department,
      timestamp: new Date(),
    });

    // Broadcast to department so peers can absorb immediately
    await this.broadcastToDepartment({
      type: 'knowledge_broadcast',
      knowledge: knowledge.content,
      domain: knowledge.domain,
      contributor: this.profile.role,
    });

    this.emit('knowledge_shared', { workerId: this.profile.workerId, knowledge });
  }

  // ─────────────────────────────────────────────────────────
  // INTERNAL
  // ─────────────────────────────────────────────────────────

  private heartbeat(): void {
    this.emit('heartbeat', {
      workerId: this.profile.workerId,
      status: this.status,
      activeGoals: this.goals.filter(g => g.status === 'active').length,
      metrics: this.getPerformanceSnapshot(),
    });
  }

  protected async handlePerformanceReview(review: Record<string, unknown>): Promise<void> {
    const snapshot = this.getPerformanceSnapshot();

    await this.communicate(review['reviewerId'] as string, {
      type: 'performance_review_response',
      workerId: this.profile.workerId,
      metrics: snapshot,
      goalsCompleted: this.goals.filter(g => g.status === 'completed').length,
      improvementPlans: this.improvementPlans,
      reflectionsCount: this.reflectionHistory.length,
    });
  }
}
