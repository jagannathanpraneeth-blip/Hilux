<div align="center">

<br/>

```
██╗  ██╗██╗██╗     ██╗   ██╗██╗  ██╗
██║  ██║██║██║     ██║   ██║╚██╗██╔╝
███████║██║██║     ██║   ██║ ╚███╔╝ 
██╔══██║██║██║     ██║   ██║ ██╔██╗ 
██║  ██║██║███████╗╚██████╔╝██╔╝ ██╗
╚═╝  ╚═╝╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝
```

### **The Operating System for Autonomous AI Workforces**

*Humans define goals. AI workforces plan, execute, verify, learn, and improve — autonomously.*

<br/>

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## What is Hilux?

Hilux is a new category of software: **The Operating System for Autonomous AI Workforces**.

It is not an AI assistant. It is not a copilot. It is not a task manager.

It is the infrastructure layer on which self-organizing, goal-directed networks of specialized AI agents **plan, collaborate, execute, verify, learn, and continuously improve** — across real systems, in real time, at any scale.

> **"Humans don't manage tasks. Humans define civilizations."**

---

## The Core Loop

```
Human States Goal
      │
      ▼
Hilux Decomposes (Planner Agent → Mission DAG)
      │
      ▼
Workforce Spawned (Specialized Agents, dynamically composed)
      │
      ▼
Agents Execute Autonomously (Tools, APIs, Code, Browsers)
      │
      ▼
Verification Layer (Critic Agents, Safety Checks)
      │
      ▼
Learning Engine (Memory, Pattern Extraction, Skill Certification)
      │
      ▼
Human Review Gate (Only exceptions, ethics, strategy)
      │
      ▼
Outcome Logged → Workforce Improves
```

---

## Architecture Overview

Hilux is designed around five core principles:

| Principle | Implementation |
|---|---|
| **Goals over Tasks** | Natural language goal input → Mission DAG decomposition |
| **Verifiability over Trust** | Cryptographic audit fabric on every agent action |
| **Continuous Learning** | 4-tier memory: Working → Episodic → Semantic → Procedural |
| **Humans are Strategic** | Automated human gates only for ambiguity & ethics |
| **The Organization is the Product** | Compound intelligence — the workforce improves over time |

### Architectural Stack

```
┌─────────────────────────────────────────────────┐
│                  LENS (Interface)                │
│         Command Bridge · Mission Control        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│               CORE (Workforce Runtime)           │
│   Planner · Dispatcher · Verifier · Learner     │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│               MIND (Memory & Knowledge)          │
│  Episodic Memory · Knowledge Graph · Skill Store│
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              SUBSTRATE (Infrastructure)          │
│   Agent Compute · Vector DB · Event Bus · Audit │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│               FABRIC (External World)            │
│  Cloud · SaaS APIs · Code · Databases · Comms   │
└─────────────────────────────────────────────────┘
```

---

## Monorepo Structure

This repository is a **pnpm monorepo** managed with [Turborepo](https://turbo.build/).

```
hilux/
├── apps/                          # Deployable applications
│   ├── api-gateway/               # Unified REST/GraphQL/WS entry point
│   ├── lens-web/                  # Command Bridge (Next.js)
│   ├── agent-runtime/             # Agent execution service
│   ├── workflow-engine/           # Mission DAG executor
│   └── audit-service/             # Cryptographic audit fabric (isolated)
│
├── packages/                      # Shared domain packages
│   ├── shared/                    # ── Cross-cutting DDD Kernel ──
│   │   ├── kernel/                # AggregateRoot, Entity, ValueObject, Result
│   │   ├── events/                # EventBus port, DomainEvent base
│   │   └── errors/                # Typed domain error hierarchy
│   │
│   ├── core/                      # ── Core Domain ──
│   │   ├── mission/               # Mission lifecycle (THE core bounded context)
│   │   │   ├── domain/            # Aggregates, Value Objects, Domain Events
│   │   │   ├── application/       # Command/Query handlers (Use Cases)
│   │   │   └── infrastructure/    # Repository implementations
│   │   └── workflow/              # DAG execution, topological scheduling
│   │
│   ├── orchestration/             # ── Agent Orchestration ──
│   │   ├── agent-registry/        # Agent capability registry
│   │   ├── agent-lifecycle/       # Agent state machine & lifecycle
│   │   └── orchestrator/          # Hierarchical orchestration (CEO/Manager/Worker)
│   │
│   ├── memory/                    # ── Memory & Knowledge ──
│   │   ├── working-memory/        # Per-agent context (Redis)
│   │   ├── episodic-memory/       # Past episodes (Qdrant vector search)
│   │   ├── semantic-memory/       # Knowledge graph (Neo4j)
│   │   └── procedural-memory/     # Skill store (PostgreSQL)
│   │
│   ├── verification/              # ── Verification & Safety ──
│   │   └── domain/                # Critic agents, safety checks, consistency
│   │
│   ├── learning/                  # ── Learning Engine ──
│   │   └── domain/                # Pattern extraction, skill certification
│   │
│   ├── tools/                     # ── Tool & Plugin Layer ──
│   │   ├── tool-registry/         # Tool capability registry
│   │   ├── tool-executor/         # Security-gated sandboxed execution
│   │   └── plugin-layer/          # WASM/V8 isolated plugin runner
│   │
│   ├── security/                  # ── Identity & Security ──
│   │   ├── identity/              # Users, organizations, RBAC
│   │   └── audit/                 # Cryptographic audit fabric
│   │
│   └── analytics/                 # ── Analytics Layer ──
│       └── projections/           # Read-model projections for dashboards
│
├── infrastructure/                # Infrastructure as Code
│   ├── terraform/                 # AWS: EKS, RDS, MSK, ElastiCache
│   └── kubernetes/                # K8s manifests, HPA, NetworkPolicies
│
├── sdk/                           # External Developer SDKs
│   ├── hilux-sdk-python/          # Python SDK (pip install hilux)
│   ├── hilux-sdk-typescript/      # TypeScript SDK (npm install @hilux/sdk)
│   └── hilux-sdk-go/              # Go SDK
│
└── docs/                          # Architecture documentation
```

---

## Key Engineering Decisions

### Why Modular Monolith (not microservices from day one)?

Development velocity at early stage. All bounded context boundaries are explicitly enforced by linting rules — extraction to a microservice is a **deployment decision**, not a code change. 90% of early-stage microservice adoptions fail due to distributed complexity before product-market fit is found.

### Why Event Sourcing?

An AI workforce that cannot replay its history cannot learn, debug, or audit. Event sourcing gives us temporal queries, mission replay, point-in-time reconstruction, and the cryptographic audit trail for free. All domain state is derived from an append-only event log — no UPDATE, no DELETE.

### Why CQRS at every domain boundary?

The write path (agent execution, mission updates) has completely different performance characteristics from the read path (Command Bridge UI, analytics). Separating them allows independent optimization and scaling.

### Why Hexagonal Architecture (Ports & Adapters)?

The domain never imports from infrastructure. Ever. This allows swapping any infrastructure component — database, message broker, LLM provider — without touching domain logic. The domain is the permanent core; infrastructure is replaceable.

### Why Railway-Oriented Error Handling (`Result<T, E>`)?

In an async, distributed agent system, throwing exceptions creates unpredictable control flow. Agents can fail in 20+ ways. `Result<T, E>` makes every error path explicit, typed, and composable at compile time.

### Why XState for Agent State Machines?

Formal state machines prevent impossible state bugs. An agent that can be simultaneously `executing` and `idle` is a logic bomb. XState makes all 12 agent states and their transitions explicit, visualizable, and testable.

---

## Domain Model — Core Concepts

| Concept | Description |
|---|---|
| **Goal** | Natural-language statement of desired organizational outcome |
| **Mission** | A bounded execution context: one goal, one workforce, one budget |
| **Mission DAG** | Directed acyclic graph of tasks derived from goal decomposition |
| **Task** | The smallest unit of work assignable to an agent |
| **Agent** | Autonomous, specialized AI entity executing tasks with tools |
| **Workforce** | The complete agent roster for a mission |
| **Orchestrator** | Meta-agent coordinating other agents toward a phase or goal |
| **Tool** | Typed interface for agents to interact with external systems |
| **Memory** | 4-tier cognitive architecture: Working → Episodic → Semantic → Procedural |
| **Skill** | A verified, reusable procedure extracted from successful executions |
| **Human Gate** | A decision point requiring human judgment to proceed |
| **Audit Event** | Cryptographically signed, tamper-evident record of every action |

---

## Mission State Machine

```
PENDING ──► PLANNING ──► EXECUTING ──► VERIFYING ──► COMPLETED
                              │              │
                           PAUSED       HUMAN_GATE
                              │              │
                          EXECUTING ◄────────┘
                              │
                           FAILED
```

All transitions are **explicitly enumerated and enforced** — invalid transitions are runtime errors.

---

## Agent State Machine (12 States)

```
idle → loading_context → planning → executing ←──────────────────┐
                                        │                         │
                                   tool_waiting                   │
                                   reflecting                     │
                                   self_correcting                │
                                   retrying                       │
                                        │                         │
                                   submitting → verified ─────────┘
                                        │
                                  awaiting_human → terminated
                                        │
                                    error (terminal)
```

---

## Memory Architecture

```
TIER 1 — WORKING MEMORY      (Redis)          < 1ms  · Per agent · Task-scoped
TIER 2 — EPISODIC MEMORY     (Qdrant)         20ms   · Per org   · Semantic search
TIER 3 — SEMANTIC MEMORY     (Neo4j)          50ms   · Per org   · Graph traversal
TIER 4 — PROCEDURAL MEMORY   (PostgreSQL)     10ms   · Per org   · Skill store
```

Memory retrieval is parallel across tiers, token-budget-aware, and source-attributed for full provenance.

---

## Technology Stack

### Application
- **Runtime**: Node.js 20+ (TypeScript 5.4, strict mode)
- **Python SDK**: Python 3.11+, async-first, fully type-annotated
- **Build**: Turborepo + pnpm workspaces
- **Framework**: Fastify (API), Next.js (Lens UI)

### Data
- **Event Store / Write Model**: PostgreSQL (CockroachDB at scale)
- **Vector Memory**: Qdrant
- **Knowledge Graph**: Neo4j
- **Working Memory / Cache**: Redis
- **Time-series / Analytics**: TimescaleDB + DuckDB
- **Object Storage**: S3-compatible

### Infrastructure
- **Orchestration**: Kubernetes (EKS)
- **Message Bus**: Apache Kafka (AWS MSK)
- **Service Mesh**: Istio
- **IaC**: Terraform + Pulumi
- **Observability**: OpenTelemetry → Grafana + Tempo + Loki

### AI / Models
- **Commercial**: Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google)
- **Open**: Llama 3.x, Mistral (self-hosted on GPU nodes)
- **Embeddings**: OpenAI text-embedding-3-large + self-hosted fallback
- **Model Routing**: Intelligent routing by task type, cost, latency

---

## Security Architecture

Every action in Hilux is:

1. **Permission-scoped** — agents never have more permissions than their current task requires
2. **Content-firewalled** — all external data is sanitized against prompt injection
3. **Cryptographically signed** — Ed25519-signed audit events, tamper-evident chain
4. **Isolated** — tool execution in sandboxed containers (WASM/V8 isolates)
5. **Monitorable** — a dedicated Security Agent watches for anomalous patterns

**Compliance**: SOC 2 Type II (Day 1) · ISO 27001 (Month 12) · GDPR/CCPA · HIPAA-ready

---

## The Python SDK

Build custom agents in minutes:

```python
from hilux import Agent, Task, TaskResult

class CompetitorIntelligenceAgent(Agent):
    name = "competitor_intelligence"
    description = "Researches competitor positioning and strategy"
    capability_tags = ["research", "analysis", "competitive_intelligence"]
    tools = ["web_search", "document_write", "data_extract"]

    async def execute(self, task: Task) -> TaskResult:
        # Search for competitor information
        search_results = await self.tools.web_search(
            query=f"site:{task.params['competitor_domain']} strategy 2026",
            max_results=20
        )

        # Synthesize findings with LLM
        analysis = await self.llm.complete(
            prompt=f"""
            Analyze these competitor results and extract:
            1. Core product positioning
            2. Target customer segments
            3. Pricing strategy signals
            4. Weak points we can exploit

            Results: {search_results}
            """,
            max_tokens=3000
        )

        return TaskResult(
            output=analysis.text,
            confidence=analysis.confidence,
            artifacts=[analysis.text]
        )

# Register with Hilux platform
await CompetitorIntelligenceAgent.register(
    hilux_api_key="hlx_...",
    pricing_per_hour_usd=2.50,
    visibility="org"  # or "marketplace" to sell to other orgs
)
```

---

## API Overview

```
REST   https://api.hilux.ai/v1
GraphQL  https://api.hilux.ai/graphql
WS       wss://api.hilux.ai/v1/stream
gRPC     grpc.hilux.ai:443
```

### Quick Start

```bash
# Create a mission
curl -X POST https://api.hilux.ai/v1/missions \
  -H "Authorization: Bearer hlx_..." \
  -H "Content-Type: application/json" \
  -d '{
    "goalText": "Analyze our top 5 competitors and produce a strategic response plan",
    "maxCostUsd": 50.00,
    "maxDurationHours": 4
  }'

# Response
{
  "missionId": "msn_01HZ...",
  "status": "PENDING",
  "goalText": "Analyze our top 5 competitors..."
}
```

---

## Deployment

Hilux runs on Kubernetes with full IaC:

```bash
# Infrastructure (Terraform)
cd infrastructure/terraform
terraform init
terraform apply -var-file="environments/prod/terraform.tfvars"

# Applications (Kubernetes)
kubectl apply -f infrastructure/kubernetes/namespaces/
kubectl apply -f infrastructure/kubernetes/deployments/
kubectl apply -f infrastructure/kubernetes/hpa/
```

Key scaling characteristics:
- **Agent Runtime**: HPA 10→500 pods, scales in 30s
- **Tool Executor**: HPA 5→100 pods, scales in 15s
- **API Gateway**: HPA 3→20 pods, scales in 20s
- **Audit Service**: Fixed 3 replicas (reliability, not scale)

---

## Competitive Moat

| Moat | Mechanism | Time to Build |
|---|---|---|
| **Compound Intelligence** | Every mission fine-tunes the org's private model | 12–24 months |
| **Organizational Memory** | Years of episodic + semantic + procedural knowledge | 6–18 months |
| **Agent Ecosystem** | 70/30 marketplace; 1000+ agent builders | 18–36 months |
| **Audit Fabric** | Regulatory-grade cryptographic provenance | 12–24 months |
| **Proprietary Model** | Trained on federated mission data | 24–48 months |

---

## Roadmap

| Quarter | Milestone |
|---|---|
| **Q4 2026** | Core Runtime v1.0 · 10 built-in tools · Lens Command Bridge alpha |
| **Q1 2027** | Multi-agent missions · Verifier v1.0 · Episodic Memory |
| **Q2 2027** | Full 4-tier memory · Learner v1.0 · Skill Store |
| **Q3 2027** | Agent SDK public beta · Marketplace alpha · Tool SDK |
| **Q4 2027** | SOC2 Type II · SSO/SAML · Data residency · Mission SLAs |
| **Q1 2028** | Hilux Model v1.0 (proprietary) · On-prem deployment |
| **Q3 2028** | 100,000 concurrent agents · Global edge presence |
| **Q4 2028** | Agent Marketplace 500+ agents · HiluxCon 2028 |

---

## Business Model

| Tier | Model | Target |
|---|---|---|
| **Mission Credits** | Pay-per-outcome (not per token) | All customers |
| **Workforce Subscription** | Monthly agent roster subscription | Growth+ |
| **Marketplace Revenue** | 30% take on third-party agent transactions | Platform |
| **Enterprise License** | Per-seat + runtime for self-hosted | Enterprise |
| **Intelligence-as-a-Service** | % of value delivered (savings/revenue) | Strategic accounts |

---

## Vision

In 10 years, every organization on Earth runs on AI workforces.

The question is not *whether* this happens — it is **who owns the infrastructure**.

Hilux's mission is to be the operating system layer for AI workforces — as foundational as Linux is for servers, as AWS is for cloud, as Stripe is for payments.

> **"Hilux is how humanity scales its mind."**

---

<div align="center">

**Built with first principles. Optimized for long-term dominance.**

[Website](https://hilux.ai) · [Docs](https://docs.hilux.ai) · [Status](https://status.hilux.ai) · [Twitter](https://twitter.com/hiluxai)

<br/>

*© 2026 Hilux AI. All rights reserved.*

</div>
