import operator
from typing import Annotated, Literal

from langgraph.graph import MessagesState


class SpartaState(MessagesState):
    session_id: str
    mode: Literal["chat", "agent"]
    active_skills: list[str]
    memory_context: str
    project_context: str
    folder_context: str
    thinking_tokens: int
    tool_calls_this_turn: int
    subagent_results: Annotated[list, operator.add]
    pending_human_input: str | None
    abort_requested: bool
    force_summary: bool
    accumulated_text: str
    plan: list[str]
    current_step: int
    plan_complete: bool
    reflection_retries: int
    suggestions: list[str]
