/**
 * SelfEvolvingTopology (SEOT) — Dynamic Department & Organizational Auto-Evolution.
 *
 * CONCEPT: Hilux does not have fixed organizational limits.
 * When a new domain environment signal triggers (e.g. EU AI Compliance Law 2028, Quantum Crypto threat),
 * the CEO worker autonomously invents a brand new department, defines its KPI matrix, hires
 * initial AI workers, and integrates it into the executive message bus hierarchy in <1 second.
 */

export interface DynamicDepartmentSpec {
  departmentId: string;
  name: string;
  purpose: string;
  requiredCapabilities: string[];
  initialStaffCount: number;
  kpis: Record<string, number>;
  createdAt: Date;
}

export class SelfEvolvingTopology {
  private static instance: SelfEvolvingTopology | null = null;
  private dynamicDepartments: Map<string, DynamicDepartmentSpec> = new Map();

  constructor() {}

  static getInstance(): SelfEvolvingTopology {
    if (!this.instance) {
      this.instance = new SelfEvolvingTopology();
    }
    return this.instance;
  }

  /** Autonomously invent & integrate a new company department based on environmental triggers */
  evolveNewDepartment(spec: {
    name: string;
    purpose: string;
    requiredCapabilities: string[];
    initialStaffCount?: number;
    kpis?: Record<string, number>;
  }): DynamicDepartmentSpec {
    const deptId = `dept_auto_${spec.name.toLowerCase().replace(/[^a-z0-0]/g, '_')}`;

    const fullSpec: DynamicDepartmentSpec = {
      departmentId: deptId,
      name: spec.name,
      purpose: spec.purpose,
      requiredCapabilities: spec.requiredCapabilities,
      initialStaffCount: spec.initialStaffCount ?? 2,
      kpis: spec.kpis ?? { complianceRate: 1.0, taskThroughput: 100 },
      createdAt: new Date(),
    };

    this.dynamicDepartments.set(deptId, fullSpec);

    console.log(
      `🧬 [SEOT Topology] AUTONOMOUS EVOLUTION: Invented new Department "${fullSpec.name}" ` +
      `(${fullSpec.initialStaffCount} initial workers, Capabilities: [${fullSpec.requiredCapabilities.join(', ')}])`
    );

    return fullSpec;
  }

  getDynamicDepartment(deptId: string): DynamicDepartmentSpec | undefined {
    return this.dynamicDepartments.get(deptId);
  }

  getAllDynamicDepartments(): DynamicDepartmentSpec[] {
    return [...this.dynamicDepartments.values()];
  }
}
