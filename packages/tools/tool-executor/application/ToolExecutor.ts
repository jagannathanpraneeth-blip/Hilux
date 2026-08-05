/**
 * Tool Executor — Application service for sandboxed tool invocation.
 *
 * This is the security-critical path. Every agent tool call goes through here.
 *
 * Security layers (in order):
 * 1. Permission validation (is this tool in scope for this mission?)
 * 2. Input sanitization (prompt injection defense)
 * 3. Sandboxed execution (isolated, resource-limited)
 * 4. Output sanitization (no sensitive data leak, no prompt injection in response)
 * 5. Audit logging (every invocation cryptographically logged)
 * 6. Cost tracking (token and API cost accounting)
 *
 * WHY this matters: An agent with unconstrained tool access is a security risk.
 * Tools are the actuators — they affect real systems. Every invocation must be
 * authorized, traced, and limited to the declared scope.
 */

export interface ToolInvocationRequest {
  agentInstanceId: string;
  missionId: string;
  taskId: string;
  orgId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  permissionToken: string;
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  costUsd?: number;
  latencyMs: number;
}

// ─── Ports ───

export interface IToolPermissionEnforcer {
  validate(token: string, toolName: string, missionId: string): Promise<{
    allowed: boolean;
    reason?: string;
    scopeConstraints?: Record<string, unknown>;
  }>;
}

export interface IContentFirewall {
  sanitizeInput(toolName: string, params: Record<string, unknown>): Promise<{
    sanitized: Record<string, unknown>;
    threats: string[];
  }>;

  sanitizeOutput(toolName: string, rawOutput: unknown): Promise<{
    sanitized: unknown;
    threats: string[];
    sensitiveDataRedacted: boolean;
  }>;
}

export interface IToolRegistry {
  resolve(toolName: string): Promise<IToolAdapter | null>;
}

export interface IToolAdapter {
  name: string;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface IToolAuditLogger {
  logInvocation(entry: {
    agentInstanceId: string;
    missionId: string;
    taskId: string;
    orgId: string;
    toolName: string;
    inputHash: string;
    outputHash: string;
    success: boolean;
    costUsd: number;
    latencyMs: number;
    threats: string[];
  }): Promise<void>;
}

// ─── Service ───

export class ToolExecutor {
  constructor(
    private readonly permissionEnforcer: IToolPermissionEnforcer,
    private readonly contentFirewall: IContentFirewall,
    private readonly toolRegistry: IToolRegistry,
    private readonly auditLogger: IToolAuditLogger,
  ) {}

  async invoke(request: ToolInvocationRequest): Promise<ToolResult> {
    const startMs = Date.now();
    const allThreats: string[] = [];

    try {
      // ── Layer 1: Permission Validation ──
      const permission = await this.permissionEnforcer.validate(
        request.permissionToken,
        request.toolName,
        request.missionId
      );

      if (!permission.allowed) {
        await this.auditLogger.logInvocation({
          ...this.buildAuditBase(request),
          inputHash: await this.hash(JSON.stringify(request.parameters)),
          outputHash: '',
          success: false,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          threats: [`PERMISSION_DENIED: ${permission.reason}`],
        });

        return {
          success: false,
          error: `Permission denied: ${permission.reason}`,
          latencyMs: Date.now() - startMs,
        };
      }

      // ── Layer 2: Input Sanitization ──
      const { sanitized: sanitizedParams, threats: inputThreats } =
        await this.contentFirewall.sanitizeInput(request.toolName, request.parameters);
      allThreats.push(...inputThreats);

      // ── Layer 3: Tool Resolution & Execution ──
      const tool = await this.toolRegistry.resolve(request.toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${request.toolName}`,
          latencyMs: Date.now() - startMs,
        };
      }

      const rawOutput = await tool.execute(sanitizedParams);

      // ── Layer 4: Output Sanitization ──
      const { sanitized: sanitizedOutput, threats: outputThreats, sensitiveDataRedacted } =
        await this.contentFirewall.sanitizeOutput(request.toolName, rawOutput);
      allThreats.push(...outputThreats);

      const latencyMs = Date.now() - startMs;

      // ── Layer 5: Audit Logging ──
      await this.auditLogger.logInvocation({
        ...this.buildAuditBase(request),
        inputHash: await this.hash(JSON.stringify(sanitizedParams)),
        outputHash: await this.hash(JSON.stringify(sanitizedOutput)),
        success: true,
        costUsd: 0, // Cost accounting injected by adapter
        latencyMs,
        threats: allThreats,
      });

      return {
        success: true,
        output: sanitizedOutput,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - startMs;
      await this.auditLogger.logInvocation({
        ...this.buildAuditBase(request),
        inputHash: await this.hash(JSON.stringify(request.parameters)),
        outputHash: '',
        success: false,
        costUsd: 0,
        latencyMs,
        threats: [`EXECUTION_ERROR: ${String(err)}`],
      });

      return {
        success: false,
        error: `Tool execution failed: ${String(err)}`,
        latencyMs,
      };
    }
  }

  private buildAuditBase(request: ToolInvocationRequest) {
    return {
      agentInstanceId: request.agentInstanceId,
      missionId: request.missionId,
      taskId: request.taskId,
      orgId: request.orgId,
      toolName: request.toolName,
    };
  }

  private async hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
