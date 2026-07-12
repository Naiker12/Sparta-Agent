"""
Unified session state for Sparta CLI REPL.

Consolidates all the loose variables (model, provider, vendor, graph,
messages, turn_count, etc.) that today travel as individual arguments
between functions.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SessionState:
    """Immutable-ish bag of state for one REPL session."""

    # --- Provider ---
    model: str = "claude-sonnet-4-6"
    provider: str = "anthropic"
    vendor: str = "anthropic"
    api_key: str | None = None

    # --- Agent graph ---
    graph: Any = None
    llm: Any = None
    tools: list[Any] = field(default_factory=list)
    skill_context: str = ""

    # --- Session ---
    session_id: str = field(default_factory=lambda: f"cli-{os.urandom(4).hex()}")
    turn_count: int = 0
    messages: list[dict] = field(default_factory=list)
    mode: str = "chat"

    # --- Feature flags (set at startup) ---
    skills: list[str] = field(default_factory=list)
    semantic_memory: bool = False
    web_search: bool = True

    # --- Derived counts (set by banner builder) ---
    tool_count: int = 0
    skills_count: int = 0
    mcp_count: int = 0

    def clone_with(self, **updates: Any) -> SessionState:
        """Return a shallow copy with the given fields replaced."""
        new = SessionState(
            model=updates.get("model", self.model),
            provider=updates.get("provider", self.provider),
            vendor=updates.get("vendor", self.vendor),
            api_key=updates.get("api_key", self.api_key),
            graph=updates.get("graph", self.graph),
            llm=updates.get("llm", self.llm),
            tools=updates.get("tools", self.tools),
            skill_context=updates.get("skill_context", self.skill_context),
            session_id=updates.get("session_id", self.session_id),
            turn_count=updates.get("turn_count", self.turn_count),
            messages=updates.get("messages", self.messages),
            mode=updates.get("mode", self.mode),
            skills=updates.get("skills", self.skills),
            semantic_memory=updates.get("semantic_memory", self.semantic_memory),
            web_search=updates.get("web_search", self.web_search),
            tool_count=updates.get("tool_count", self.tool_count),
            skills_count=updates.get("skills_count", self.skills_count),
            mcp_count=updates.get("mcp_count", self.mcp_count),
        )
        return new

    def model_short(self) -> str:
        m = self.model.split("/")[-1] if "/" in self.model else self.model
        if len(m) > 28:
            m = m[:25] + "..."
        return m

    def prompt_text(self) -> str:
        return "› "
