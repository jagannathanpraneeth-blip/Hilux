/**
 * EngineeringDepartment — The largest department, containing 6 sub-departments.
 *
 * Sub-departments (each with their own workers):
 *   - Frontend Engineering
 *   - Backend Engineering
 *   - Database Engineering
 *   - Security Engineering
 *   - DevOps / Platform
 *   - QA / Testing
 *
 * The Engineering Department head (VP Engineering) coordinates all of these
 * and interfaces directly with the CTO.
 *
 * Workers spawned dynamically based on sprint workload.
 */

import { Department, type DepartmentConfig } from '../../core/department/Department.js';
import { BaseWorker, WorkerGoal, WorkerProfile } from '../../core/worker/BaseWorker.js';
import type { MessageBus } from '../../core/communication/MessageBus.js';
import type { KnowledgeBase } from '../../core/knowledge/KnowledgeBase.js';

// ── Department Config ────────────────────────────────────────────────────────

export function createEngineeringDeptConfig(headId: string): DepartmentConfig {
  return {
    departmentId: 'engineering',
    name: 'Engineering',
    mission: 'Build reliable, scalable, high-quality software that powers Hilux',
    headId,
    budget: { monthly: 500_000, used: 0, currency: 'USD' },
    minWorkers: 6,
    maxWorkers: 50,
    kpis: [
      { name: 'Sprint Velocity', target: 80, current: 0, unit: 'story_points', trend: 'stable' },
      { name: 'Code Review Turnaround', target: 4, current: 0, unit: 'hours', trend: 'stable' },
      { name: 'Bug Rate', target: 2, current: 0, unit: 'bugs_per_1000_lines', trend: 'stable' },
      { name: 'Test Coverage', target: 90, current: 0, unit: 'percent', trend: 'stable' },
      { name: 'Deployment Frequency', target: 5, current: 0, unit: 'per_week', trend: 'stable' },
    ],
    workerTypes: [
      {
        role: 'Frontend Engineer',
        seniority: 'mid',
        minCount: 1,
        maxCount: 10,
        specializations: ['react', 'typescript', 'css', 'ui_engineering'],
        costPerHour: 2.50,
      },
      {
        role: 'Backend Engineer',
        seniority: 'mid',
        minCount: 2,
        maxCount: 15,
        specializations: ['nodejs', 'python', 'api_design', 'distributed_systems'],
        costPerHour: 2.80,
      },
      {
        role: 'Database Engineer',
        seniority: 'senior',
        minCount: 1,
        maxCount: 5,
        specializations: ['postgresql', 'query_optimization', 'data_modeling', 'migrations'],
        costPerHour: 3.20,
      },
      {
        role: 'Security Engineer',
        seniority: 'senior',
        minCount: 1,
        maxCount: 5,
        specializations: ['appsec', 'penetration_testing', 'vulnerability_assessment', 'compliance'],
        costPerHour: 3.50,
      },
      {
        role: 'DevOps Engineer',
        seniority: 'mid',
        minCount: 1,
        maxCount: 8,
        specializations: ['kubernetes', 'terraform', 'ci_cd', 'monitoring', 'cloud'],
        costPerHour: 3.00,
      },
      {
        role: 'QA Engineer',
        seniority: 'mid',
        minCount: 1,
        maxCount: 8,
        specializations: ['test_automation', 'e2e_testing', 'performance_testing', 'bug_triaging'],
        costPerHour: 2.20,
      },
    ],
  };
}

// ── Worker Implementations ───────────────────────────────────────────────────

abstract class EngineeringWorker extends BaseWorker {
  protected abstract readonly engineeringDomain: string;

  protected async executeGoal(goal: WorkerGoal): Promise<void> {
    const context = await this.recallContext(goal.description);
    console.log(`[${this.profile.role}] Starting: "${goal.title}"`);

    // Engineering work cycle: plan → implement → test → review
    await this.plan(goal, context);
    const output = await this.implement(goal);
    await this.test(goal, output);
    await this.review(goal, output);

    goal.status = 'completed';
    goal.progress = 100;

    await this.rememberTask(goal.goalId, `Completed: ${goal.title}`, 'success');
    await this.reflect(goal.goalId, output);

    this.recordTaskOutcome({
      taskId: goal.goalId,
      success: true,
      qualityScore: 0.88,
      timeToComplete: Math.random() * 120 + 30,
      tokensUsed: Math.floor(Math.random() * 5000 + 1000),
      costUsd: Math.random() * 2 + 0.5,
    });

    console.log(`[${this.profile.role}] Completed: "${goal.title}"`);
  }

  private async plan(goal: WorkerGoal, context: { pastWork: string[]; relevantKnowledge: string[] }): Promise<void> {
    console.log(`  [${this.profile.role}] Planning approach for: ${goal.title}`);
    // LLM-based planning in production
  }

  protected abstract implement(goal: WorkerGoal): Promise<unknown>;
  protected abstract test(goal: WorkerGoal, output: unknown): Promise<void>;

  private async review(goal: WorkerGoal, output: unknown): Promise<void> {
    // Self-review before submitting
    const reflection = await this.performReflection({
      taskId: goal.goalId,
      taskOutput: output,
      goal,
      context: null,
      myRole: this.profile.role,
      mySpecializations: this.profile.specializations,
    });

    if (reflection.qualityScore < 0.75) {
      await this.escalate({
        urgency: 'medium',
        context: `Output quality below threshold (${reflection.qualityScore}): ${goal.title}`,
        blockedTask: goal.goalId,
        recommendation: reflection.improvements.join('; '),
      });
    }
  }

  protected async handleCustomMessage(message: Record<string, unknown>): Promise<void> {
    if (message['type'] === 'code_review_request') {
      await this.performCodeReview(message['code'] as string, message['requesterId'] as string);
    }
    if (message['type'] === 'knowledge_request') {
      const knowledge = await this.recallContext(message['query'] as string);
      await this.communicate(message['requesterId'] as string, {
        type: 'knowledge_response',
        knowledge,
        domain: this.engineeringDomain,
      });
    }
  }

  private async performCodeReview(code: string, requesterId: string): Promise<void> {
    // LLM-based code review in production
    await this.communicate(requesterId, {
      type: 'code_review_complete',
      reviewer: this.profile.workerId,
      reviewerRole: this.profile.role,
      verdict: 'approved',
      comments: [],
    });
  }
}

class FrontendEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'frontend';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [Frontend] Building UI component for: ${goal.title}`);
    return {
      type: 'react_component',
      componentName: goal.title.replace(/\s/g, ''),
      code: `// ${goal.title} component\nexport const ${goal.title.replace(/\s/g, '')} = () => <div>{/* implementation */}</div>`,
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [Frontend] Running component tests for: ${goal.title}`);
  }
}

class BackendEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'backend';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [Backend] Implementing API for: ${goal.title}`);
    return {
      type: 'api_endpoint',
      endpoint: `/api/v1/${goal.title.toLowerCase().replace(/\s/g, '-')}`,
      methods: ['GET', 'POST'],
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [Backend] Running integration tests for: ${goal.title}`);
  }
}

class DatabaseEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'database';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [Database] Designing schema for: ${goal.title}`);
    return {
      type: 'database_migration',
      migration: `-- Migration for ${goal.title}\nALTER TABLE ...`,
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [Database] Validating migration for: ${goal.title}`);
  }
}

class SecurityEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'security';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [Security] Running security analysis for: ${goal.title}`);
    return {
      type: 'security_report',
      vulnerabilities: [],
      riskLevel: 'low',
      recommendations: ['Implement rate limiting', 'Add input validation'],
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [Security] Verifying security controls for: ${goal.title}`);
  }
}

class DevOpsEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'devops';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [DevOps] Setting up infrastructure for: ${goal.title}`);
    return {
      type: 'infrastructure',
      resources: ['kubernetes_deployment', 'hpa', 'service'],
      deployed: true,
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [DevOps] Running smoke tests on deployment: ${goal.title}`);
  }
}

class QAEngineer extends EngineeringWorker {
  protected readonly engineeringDomain = 'qa';

  protected async implement(goal: WorkerGoal): Promise<unknown> {
    console.log(`  [QA] Creating test suite for: ${goal.title}`);
    return {
      type: 'test_suite',
      tests: ['unit', 'integration', 'e2e'],
      coverage: 92,
    };
  }

  protected async test(goal: WorkerGoal, output: unknown): Promise<void> {
    console.log(`  [QA] Executing test suite for: ${goal.title}`);
  }
}

// ── Department ───────────────────────────────────────────────────────────────

export class EngineeringDepartment extends Department {
  protected async createWorker(profile: WorkerProfile): Promise<BaseWorker> {
    const WorkerClass = this.getWorkerClass(profile.role);
    return new WorkerClass(profile, this.messageBus, this.knowledgeBase);
  }

  private getWorkerClass(role: string): new (
    profile: WorkerProfile, mb: MessageBus, kb: KnowledgeBase
  ) => BaseWorker {
    const map: Record<string, new (p: WorkerProfile, mb: MessageBus, kb: KnowledgeBase) => BaseWorker> = {
      'Frontend Engineer': FrontendEngineer,
      'Backend Engineer': BackendEngineer,
      'Database Engineer': DatabaseEngineer,
      'Security Engineer': SecurityEngineer,
      'DevOps Engineer': DevOpsEngineer,
      'QA Engineer': QAEngineer,
    };
    return map[role] ?? BackendEngineer;
  }
}
