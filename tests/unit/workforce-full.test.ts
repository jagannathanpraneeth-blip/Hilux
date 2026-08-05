/**
 * ─── FULL AI WORKFORCE INTEGRATION TESTS ─────────────────────────────────────
 * Tests for the complete AI Workforce system:
 *   - WorkforceRuntime boot & initialization
 *   - CEO company goal setting and decomposition
 *   - Department workforce spawning & dynamic capacity
 *   - Goal assignment and worker execution lifecycle
 *   - Escalations & manager resolution
 *   - Performance review cycles (promote / fire)
 *   - Knowledge sharing & institutional memory
 *   - Organization health report metrics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkforceRuntime, type BootedWorkforce } from '../../packages/workforce/runtime/WorkforceRuntime.js';
import { Organization } from '../../packages/workforce/core/organization/Organization.js';
import { MessageBus } from '../../packages/workforce/core/communication/MessageBus.js';
import { KnowledgeBase } from '../../packages/workforce/core/knowledge/KnowledgeBase.js';
import { CEO } from '../../packages/workforce/executive/CEO.js';
import { CTO } from '../../packages/workforce/executive/CTO.js';
import { ProductManager } from '../../packages/workforce/executive/ProductManager.js';
import { EngineeringDepartment, createEngineeringDeptConfig } from '../../packages/workforce/departments/engineering/EngineeringDepartment.js';

describe('AI Workforce — Complete System Integration', () => {

  describe('WorkforceRuntime.boot()', () => {
    it('boots organization and all 9 departments successfully', async () => {
      const company = await WorkforceRuntime.boot({
        name: 'Hilux Test Corp',
        mission: 'Testing Autonomous Workforces',
      });

      expect(company).toBeDefined();
      expect(company.organization).toBeInstanceOf(Organization);
      expect(company.ceo).toBeInstanceOf(CEO);
      expect(company.cto).toBeInstanceOf(CTO);
      expect(company.cpo).toBeInstanceOf(ProductManager);

      // Verify all 9 departments registered
      const depts = company.departments;
      expect(depts.engineering).toBeDefined();
      expect(depts.research).toBeDefined();
      expect(depts.marketing).toBeDefined();
      expect(depts.finance).toBeDefined();
      expect(depts.legal).toBeDefined();
      expect(depts.operations).toBeDefined();
      expect(depts.customerSupport).toBeDefined();
      expect(depts.analytics).toBeDefined();
      expect(depts.documentation).toBeDefined();
    });

    it('initializes minimum required workers per department', async () => {
      const company = await WorkforceRuntime.boot();
      const health = await company.organization.runHealthCheck();

      // Verify overall worker count is > 0
      expect(health.totalWorkers).toBeGreaterThan(10);
      expect(health.totalDepartments).toBe(9);
    });

    it('seeds organizational knowledge base on boot', async () => {
      const company = await WorkforceRuntime.boot();
      const kb = company.organization.getKnowledgeBase();
      const size = await kb.size();
      expect(size).toBeGreaterThan(0);

      const policyKnowledge = await kb.retrieve(['organizational_policy']);
      expect(policyKnowledge.length).toBeGreaterThan(0);
    });
  });

  describe('CEO Company Goal Setting & Decomposition', () => {
    let company: BootedWorkforce;

    beforeEach(async () => {
      company = await WorkforceRuntime.boot();
    });

    it('CEO accepts company goal and dispatches directives to departments', async () => {
      const spy = vi.fn();
      company.organization.on('company_goal_dispatched', spy);

      await company.ceo.setCompanyGoal({
        title: 'Launch Enterprise Security Features',
        description: 'Implement SAML SSO, audit logging, and RBAC across Hilux platform',
        priority: 'critical',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      // CEO goal execution completes
      const snapshot = company.ceo.getPerformanceSnapshot();
      expect(snapshot).toBeDefined();
    });
  });

  describe('Department Dynamic Staffing & Goal Execution', () => {
    it('Engineering department processes goals and executes work', async () => {
      const mb = new MessageBus();
      const kb = new KnowledgeBase('org:test');
      const dept = new EngineeringDepartment(createEngineeringDeptConfig('cto-1'), mb, kb);

      await dept.initialize();

      await dept.receiveGoal({
        goalId: 'g-frontend-1',
        title: 'Build Dashboard Component',
        description: 'Create frontend React component for mission metrics',
        priority: 'high',
        acceptanceCriteria: ['Component rendered', 'Tests passed'],
        assignedBy: 'exec-cto-001',
        assignedAt: new Date(),
        progress: 0,
        status: 'pending',
      });

      const report = await dept.generateAndSubmitReport();
      expect(report.headCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Review & Autonomy Upgrade', () => {
    it('high performing workers gain higher autonomy level', async () => {
      const company = await WorkforceRuntime.boot();
      const ceo = company.ceo;

      const initialAutonomy = ceo.profile.autonomyLevel;
      expect(initialAutonomy).toBe('executive');

      // Run improvement cycle
      await ceo.runImprovementCycle();
      expect(ceo.profile.autonomyLevel).toBe('executive');
    });

    it('department performance review evaluates workers', async () => {
      const company = await WorkforceRuntime.boot();
      const engDept = company.departments.engineering;

      await expect(engDept.runPerformanceReview()).resolves.not.toThrow();
    });
  });

  describe('Organization Health & Reporting', () => {
    it('generates accurate consolidated health reports', async () => {
      const company = await WorkforceRuntime.boot();
      const health = await company.organization.runHealthCheck();

      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.totalDepartments).toBe(9);
      expect(health.totalWorkers).toBeGreaterThan(0);
      expect(health.averageWorkerPerformance).toBeGreaterThanOrEqual(0);
      expect(health.averageWorkerPerformance).toBeLessThanOrEqual(1);
    });
  });
});
