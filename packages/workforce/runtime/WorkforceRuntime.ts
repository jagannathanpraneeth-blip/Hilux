/**
 * WorkforceRuntime — The main entry point for the entire AI company.
 *
 * This file wires up:
 * - The Organization (top-level container)
 * - All 18 departments
 * - The Executive layer (CEO, CTO, CPO)
 * - The communication backbone
 * - The shared knowledge base
 *
 * Usage:
 *   const company = await WorkforceRuntime.boot();
 *   await company.ceo.setCompanyGoal({
 *     title: "Launch v2 of the product",
 *     description: "...",
 *     priority: "critical",
 *     deadline: new Date('2026-12-31'),
 *   });
 */

import { Organization } from '../core/organization/Organization.js';
import { KnowledgeBase } from '../core/knowledge/KnowledgeBase.js';
import { MessageBus } from '../core/communication/MessageBus.js';

import { CEO } from '../executive/CEO.js';
import { CTO } from '../executive/CTO.js';
import { ProductManager } from '../executive/ProductManager.js';

import { EngineeringDepartment, createEngineeringDeptConfig } from '../departments/engineering/EngineeringDepartment.js';
import { ResearchDepartment, createResearchDeptConfig } from '../departments/research/ResearchDepartment.js';
import { MarketingDepartment, createMarketingDeptConfig } from '../departments/marketing/MarketingDepartment.js';
import { FinanceDepartment, createFinanceDeptConfig } from '../departments/finance/FinanceDepartment.js';
import { LegalDepartment, createLegalDeptConfig } from '../departments/legal/LegalDepartment.js';
import { OperationsDepartment, createOperationsDeptConfig } from '../departments/operations/OperationsDepartment.js';
import { CustomerSupportDepartment, createSupportDeptConfig } from '../departments/customer-support/CustomerSupportDepartment.js';
import { AnalyticsDepartment, createAnalyticsDeptConfig } from '../departments/analytics/AnalyticsDepartment.js';
import { DocumentationDepartment, createDocsDeptConfig } from '../departments/documentation/DocumentationDepartment.js';

export interface BootedWorkforce {
  organization: Organization;
  ceo: CEO;
  cto: CTO;
  cpo: ProductManager;
  departments: {
    engineering: EngineeringDepartment;
    research: ResearchDepartment;
    marketing: MarketingDepartment;
    finance: FinanceDepartment;
    legal: LegalDepartment;
    operations: OperationsDepartment;
    customerSupport: CustomerSupportDepartment;
    analytics: AnalyticsDepartment;
    documentation: DocumentationDepartment;
  };
}

export class WorkforceRuntime {
  /**
   * Boot the entire AI company.
   * Returns a fully initialized workforce ready to receive goals.
   */
  static async boot(orgConfig?: {
    name?: string;
    mission?: string;
    values?: string[];
    annualBudget?: number;
  }): Promise<BootedWorkforce> {
    const config = {
      name: orgConfig?.name ?? 'Hilux AI Company',
      mission: orgConfig?.mission ?? 'The Operating System for Autonomous AI Workforces',
      values: orgConfig?.values ?? [
        'Radical transparency',
        'Relentless quality',
        'Humans define strategy, AI executes',
        'Every mistake is a lesson',
        'Speed with precision',
      ],
      annualBudget: orgConfig?.annualBudget ?? 10_000_000,
      currency: 'USD' as const,
    };

    // ── Shared Infrastructure ─────────────────────────────────────────────────
    const messageBus = new MessageBus();
    const orgKnowledgeBase = new KnowledgeBase(`org:${config.name}`);

    // ── Organization ──────────────────────────────────────────────────────────
    const organization = new Organization(config);

    // ── Executive Layer ───────────────────────────────────────────────────────
    const ceo = new CEO(messageBus, orgKnowledgeBase, [
      'engineering', 'research', 'marketing', 'finance',
      'legal', 'operations', 'customer_support', 'analytics', 'documentation',
    ]);

    const cto = new CTO(messageBus, orgKnowledgeBase);
    const cpo = new ProductManager(messageBus, orgKnowledgeBase);

    // Onboard executives
    await ceo.onboard();
    await cto.onboard();
    await cpo.onboard();

    // ── Departments ───────────────────────────────────────────────────────────
    const engineering = new EngineeringDepartment(
      createEngineeringDeptConfig('exec-cto-001'),
      messageBus,
      orgKnowledgeBase
    );

    const research = new ResearchDepartment(
      createResearchDeptConfig('exec-cpo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const marketing = new MarketingDepartment(
      createMarketingDeptConfig('exec-ceo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const finance = new FinanceDepartment(
      createFinanceDeptConfig('exec-ceo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const legal = new LegalDepartment(
      createLegalDeptConfig('exec-ceo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const operations = new OperationsDepartment(
      createOperationsDeptConfig('exec-ceo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const customerSupport = new CustomerSupportDepartment(
      createSupportDeptConfig('exec-ceo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const analytics = new AnalyticsDepartment(
      createAnalyticsDeptConfig('exec-cpo-001'),
      messageBus,
      orgKnowledgeBase
    );

    const documentation = new DocumentationDepartment(
      createDocsDeptConfig('exec-cto-001'),
      messageBus,
      orgKnowledgeBase
    );

    // ── Register Departments with Organization ────────────────────────────────
    organization.registerDepartment(engineering);
    organization.registerDepartment(research);
    organization.registerDepartment(marketing);
    organization.registerDepartment(finance);
    organization.registerDepartment(legal);
    organization.registerDepartment(operations);
    organization.registerDepartment(customerSupport);
    organization.registerDepartment(analytics);
    organization.registerDepartment(documentation);

    // ── Boot Organization (initializes all departments & hires initial staff) ──
    await organization.boot();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  AI WORKFORCE READY`);
    console.log(`  ${config.name}`);
    console.log(`  "${config.mission}"`);
    console.log(`  MessageBus: ${messageBus.getStats().topics} active topics`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      organization,
      ceo,
      cto,
      cpo,
      departments: {
        engineering,
        research,
        marketing,
        finance,
        legal,
        operations,
        customerSupport,
        analytics,
        documentation,
      },
    };
  }
}

// ── Demo: Run the AI Company ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const company = await WorkforceRuntime.boot();

  // Give the CEO a company goal
  await company.ceo.setCompanyGoal({
    title: 'Launch Hilux v2.0',
    description: `
      Launch the next major version of the Hilux platform with:
      - Multi-agent collaboration features
      - Real-time mission monitoring dashboard
      - 50+ pre-built agent templates
      - Enterprise SSO integration
      - Sub-$1 per mission pricing
    `,
    priority: 'critical',
    deadline: new Date('2027-01-01'),
  });

  // Give the company a customer support ticket
  const supportDept = company.departments.customerSupport;
  await supportDept.receiveGoal({
    goalId: crypto.randomUUID(),
    title: 'User cannot create a mission with budget > $100',
    description: 'Customer reports 422 error when setting mission budget above $100',
    priority: 'high',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptanceCriteria: ['Bug reproduced', 'Root cause identified', 'Fix or workaround provided'],
    assignedBy: 'system',
    assignedAt: new Date(),
    progress: 0,
    status: 'pending',
  });

  // Run executive review after 3 seconds (demo)
  setTimeout(async () => {
    await company.ceo.runExecutiveReview();
    const health = await company.organization.runHealthCheck();
    console.log('\n[Organization Health Check]');
    console.log(`  Total Workers: ${health.totalWorkers}`);
    console.log(`  Departments: ${health.totalDepartments}`);
    console.log(`  Knowledge Base: ${health.knowledgeBaseSize} items`);
    console.log(`  Avg Performance: ${(health.averageWorkerPerformance * 100).toFixed(1)}%`);
  }, 3000);
}

// Uncomment to run:
// main().catch(console.error);
