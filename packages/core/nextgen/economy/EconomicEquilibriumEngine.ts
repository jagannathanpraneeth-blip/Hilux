/**
 * EconomicEquilibriumEngine (EEE) — Autonomous Internal P&L Credit Market.
 *
 * CONCEPT: No central human budgeting. Every department and worker runs an internal P&L.
 * Departments earn HILUX-CREDITS when their deliverables pass verification & produce ROI.
 * High-ROI departments gain compute priority; low-performing departments shrink or hire QA auditors.
 */

export interface DepartmentLedger {
  departmentId: string;
  name: string;
  balanceCredits: number;
  monthlyComputeAllowanceUsd: number;
  totalSpentUsd: number;
  totalRevenueEarnedCredits: number;
  roiRatio: number;
}

export class EconomicEquilibriumEngine {
  private ledgers: Map<string, DepartmentLedger> = new Map();
  private static instance: EconomicEquilibriumEngine | null = null;

  constructor() {}

  static getInstance(): EconomicEquilibriumEngine {
    if (!this.instance) {
      this.instance = new EconomicEquilibriumEngine();
    }
    return this.instance;
  }

  registerDepartment(departmentId: string, name: string, initialGrantCredits = 1000): DepartmentLedger {
    const ledger: DepartmentLedger = {
      departmentId,
      name,
      balanceCredits: initialGrantCredits,
      monthlyComputeAllowanceUsd: 500,
      totalSpentUsd: 0,
      totalRevenueEarnedCredits: 0,
      roiRatio: 1.0,
    };
    this.ledgers.set(departmentId, ledger);
    return ledger;
  }

  /** Reward department with credits upon successful task completion & verification */
  rewardTaskSuccess(departmentId: string, taskValueCredits: number, executionQuality: number): void {
    const ledger = this.ledgers.get(departmentId);
    if (!ledger) return;

    const earned = taskValueCredits * executionQuality;
    ledger.balanceCredits += earned;
    ledger.totalRevenueEarnedCredits += earned;
    ledger.roiRatio = ledger.totalRevenueEarnedCredits / Math.max(1, ledger.totalSpentUsd * 10);

    console.log(
      `💰 [EEE Market] ${ledger.name} earned +${earned.toFixed(1)} HILUX-CREDITS ` +
      `(Balance: ${ledger.balanceCredits.toFixed(1)}, ROI: ${ledger.roiRatio.toFixed(2)}x)`
    );

    this.rebalanceComputeAllowances();
  }

  /** Deduct compute cost from department ledger */
  deductComputeCost(departmentId: string, computeCostUsd: number): boolean {
    const ledger = this.ledgers.get(departmentId);
    if (!ledger) return false;

    const creditCost = computeCostUsd * 100; // 1 USD = 100 HILUX-CREDITS
    if (ledger.balanceCredits < creditCost) {
      console.warn(`⚠️ [EEE Market] ${ledger.name} INSUFFICIENT CREDITS! (Balance: ${ledger.balanceCredits}, Required: ${creditCost})`);
      return false;
    }

    ledger.balanceCredits -= creditCost;
    ledger.totalSpentUsd += computeCostUsd;
    return true;
  }

  /** Dynamic Market Rebalancing — allocate higher LLM compute budget to top ROI departments */
  private rebalanceComputeAllowances(): void {
    const totalCredits = [...this.ledgers.values()].reduce((sum, l) => sum + l.balanceCredits, 0);
    if (totalCredits === 0) return;

    for (const ledger of this.ledgers.values()) {
      const share = ledger.balanceCredits / totalCredits;
      ledger.monthlyComputeAllowanceUsd = Math.round(5000 * share); // $5,000 pool
    }
  }

  getLedger(departmentId: string): DepartmentLedger | undefined {
    return this.ledgers.get(departmentId);
  }

  getAllLedgers(): DepartmentLedger[] {
    return [...this.ledgers.values()];
  }
}
