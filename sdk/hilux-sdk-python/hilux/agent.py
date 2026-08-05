"""
Hilux Python SDK — Core module
The official Python SDK for building custom agents on the Hilux platform.

Design principles:
  - Pythonic API: async-first, type-annotated, minimal boilerplate
  - Transparent: every operation is observable (structured logging)
  - Safe: no agent can accidentally exceed its declared permissions
  - Testable: every component is mockable via dependency injection

Usage:
    from hilux import Agent, Task, tool, Mission

    class MyResearchAgent(Agent):
        name = "my_research_agent"
        description = "Researches market trends"
        capability_tags = ["research", "web_analysis"]
        tools = ["web_search", "document_write"]

        async def execute(self, task: Task) -> TaskResult:
            results = await self.tools.web_search(
                query=task.params["topic"],
                max_results=10
            )
            synthesis = await self.llm.complete(
                prompt=f"Synthesize these search results: {results}",
                max_tokens=2000
            )
            return TaskResult(
                output=synthesis.text,
                confidence=synthesis.confidence,
                artifacts=[synthesis.text]
            )
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar, Optional, Sequence

logger = logging.getLogger(__name__)


@dataclass
class Task:
    """Represents an atomic unit of work assigned to an agent."""
    task_id: str
    title: str
    description: str
    params: dict[str, Any] = field(default_factory=dict)
    acceptance_criteria: list[str] = field(default_factory=list)
    mission_id: str = ""
    org_id: str = ""
    token_budget: int = 8000
    cost_budget_usd: float = 10.0


@dataclass
class TaskResult:
    """The output of agent task execution."""
    output: Any
    confidence: float  # 0.0 - 1.0
    artifacts: list[Any] = field(default_factory=list)
    reasoning_trace: str = ""
    tool_calls_made: int = 0
    tokens_used: int = 0
    cost_usd: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Confidence must be 0.0-1.0, got {self.confidence}")


@dataclass
class LLMResponse:
    """Response from an LLM completion."""
    text: str
    confidence: float
    model: str
    tokens_used: int
    cost_usd: float


class ToolProxy:
    """
    Proxy object for tool invocations.
    Enforces permission boundaries and audit logging transparently.

    Agents access tools via: self.tools.<tool_name>(params)
    """
    def __init__(self, agent_instance_id: str, mission_id: str, allowed_tools: list[str]) -> None:
        self._agent_instance_id = agent_instance_id
        self._mission_id = mission_id
        self._allowed_tools = set(allowed_tools)
        self._call_count = 0

    def __getattr__(self, tool_name: str) -> Any:
        if tool_name.startswith("_"):
            raise AttributeError(tool_name)

        if tool_name not in self._allowed_tools:
            raise PermissionError(
                f"Tool '{tool_name}' not in agent's declared tool list: {self._allowed_tools}. "
                f"Add it to your agent's 'tools' class attribute."
            )

        async def invoke(**kwargs: Any) -> Any:
            self._call_count += 1
            logger.info(
                "Tool invocation",
                extra={
                    "tool_name": tool_name,
                    "agent_instance_id": self._agent_instance_id,
                    "mission_id": self._mission_id,
                    "call_number": self._call_count,
                }
            )
            # In production: gRPC call to Tool Executor service
            # In tests: resolved via mock registry
            from hilux._runtime import get_tool_executor
            executor = get_tool_executor()
            return await executor.invoke(
                tool_name=tool_name,
                params=kwargs,
                agent_instance_id=self._agent_instance_id,
                mission_id=self._mission_id,
            )

        return invoke


class LLMProxy:
    """
    Proxy for LLM completions.
    Handles model routing, token tracking, and cost accounting.
    """
    def __init__(self, agent_instance_id: str, token_budget: int) -> None:
        self._agent_instance_id = agent_instance_id
        self._token_budget = token_budget
        self._tokens_used = 0

    async def complete(
        self,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.3,
        model: Optional[str] = None,
    ) -> LLMResponse:
        if self._tokens_used + max_tokens > self._token_budget:
            raise RuntimeError(
                f"Token budget exceeded: used {self._tokens_used}, "
                f"budget {self._token_budget}, requested {max_tokens}"
            )

        from hilux._runtime import get_llm_router
        router = get_llm_router()
        response = await router.complete(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            preferred_model=model,
            agent_instance_id=self._agent_instance_id,
        )

        self._tokens_used += response.tokens_used
        return response

    @property
    def tokens_used(self) -> int:
        return self._tokens_used


class Agent(ABC):
    """
    Base class for all Hilux agents.

    Subclass this and implement `execute()` to create a custom agent.
    The SDK handles: context loading, memory access, tool permissions,
    LLM routing, reflection, self-correction, and audit logging.

    Class variables (configure your agent):
        name: Unique identifier for this agent type
        description: Human-readable description
        capability_tags: Skills this agent has (used for routing)
        tools: Tool names this agent is permitted to use
        model_preference: Preferred LLM model (optional)
        escalation_threshold: Confidence below which to escalate (default 0.75)
        max_retries: Max self-correction attempts (default 3)
    """

    name: ClassVar[str]
    description: ClassVar[str]
    capability_tags: ClassVar[list[str]] = []
    tools: ClassVar[list[str]] = []
    model_preference: ClassVar[Optional[str]] = None
    escalation_threshold: ClassVar[float] = 0.75
    max_retries: ClassVar[int] = 3

    def __init__(
        self,
        agent_instance_id: str,
        task: Task,
        memory_context: dict[str, Any],
    ) -> None:
        self.agent_instance_id = agent_instance_id
        self.current_task = task
        self.memory_context = memory_context
        self.tools_proxy = ToolProxy(
            agent_instance_id=agent_instance_id,
            mission_id=task.mission_id,
            allowed_tools=self.__class__.tools,
        )
        self.llm = LLMProxy(
            agent_instance_id=agent_instance_id,
            token_budget=task.token_budget,
        )
        self._retry_count = 0

    @abstractmethod
    async def execute(self, task: Task) -> TaskResult:
        """
        Implement your agent's core execution logic here.

        Use self.tools.<tool_name>() to invoke tools.
        Use self.llm.complete() for LLM completions.
        Use self.memory for accessing organizational memory.

        Return a TaskResult with confidence score.
        If confidence < escalation_threshold, the system will
        prompt you to self-correct or escalate to human.
        """
        ...

    async def reflect(self, task: Task, partial_result: TaskResult) -> dict[str, Any]:
        """
        Override to customize reflection behavior.
        Default: LLM-based self-critique of partial result.
        """
        reflection_prompt = f"""
        Task: {task.description}
        Acceptance Criteria: {task.acceptance_criteria}
        My result so far: {partial_result.output}

        Evaluate:
        1. Does my result satisfy the acceptance criteria? (score 0-1)
        2. What are potential errors or gaps?
        3. Should I continue, self-correct, or escalate?

        Respond as JSON: {{"score": 0.0, "issues": [], "recommendation": "continue|self_correct|escalate"}}
        """
        response = await self.llm.complete(reflection_prompt, max_tokens=500, temperature=0.1)
        import json
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            return {"score": 0.5, "issues": ["Reflection parse error"], "recommendation": "continue"}

    @classmethod
    def manifest(cls) -> dict[str, Any]:
        """Generate the agent manifest for registration in the Hilux registry."""
        return {
            "name": cls.name,
            "description": cls.description,
            "capability_tags": cls.capability_tags,
            "tools": cls.tools,
            "model_preference": cls.model_preference,
            "escalation_threshold": cls.escalation_threshold,
            "max_retries": cls.max_retries,
            "sdk_version": "0.1.0",
        }

    @classmethod
    async def register(
        cls,
        hilux_api_key: str,
        pricing_per_hour_usd: float = 1.0,
        visibility: str = "private",  # "private" | "org" | "marketplace"
    ) -> dict[str, Any]:
        """Register this agent type with the Hilux platform."""
        from hilux._client import HiluxClient
        client = HiluxClient(api_key=hilux_api_key)
        return await client.register_agent(
            manifest=cls.manifest(),
            pricing_per_hour_usd=pricing_per_hour_usd,
            visibility=visibility,
        )
