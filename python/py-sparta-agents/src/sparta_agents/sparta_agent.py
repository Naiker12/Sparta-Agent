import logging
from typing import Any

from langgraph.graph import StateGraph, START, END

from sparta_agents.graph_state import SpartaState
from sparta_agents.graph_nodes import (
    agent_node,
    tool_node,
    subagent_node,
    reflection_node_wrapped,
)
from sparta_agents.graph_helpers import should_continue
from sparta_agents.reflection import should_reflect
from sparta_agents.subagents.research_agent import research_topic
from sparta_agents.subagents.code_agent import execute_code_task
from sparta_agents.subagents.memory_agent import recall_memories
from sparta_agents.subagents.review_agent import review_changes
from sparta_security.permission_policy import PermissionPolicy, get_policy, set_policy_mode
from sparta_tools.plan_tool import create_plan_tool

logger = logging.getLogger("sparta_ai.agents.sparta")


def build_sparta_graph(
    llm: Any,
    tools: list,
    skill_context: str = "",
    memory_context: str = "",
    checkpointer: Any | None = None,
    policy_mode: str = "build",
    vendor: str = "openai",
    model: str = "",
) -> StateGraph:
    set_policy_mode(policy_mode)
    policy = PermissionPolicy(mode=policy_mode)
    all_tools = tools + [create_plan_tool]
    delegate_tools = [research_topic, execute_code_task, recall_memories, review_changes]

    llm_with_tools = llm.bind_tools(all_tools + delegate_tools)
    plan_tools = policy.filter_tools(all_tools)
    llm_plan = llm.bind_tools(plan_tools + delegate_tools) if plan_tools else llm
    chat_policy = PermissionPolicy(mode="chat")
    chat_tools = chat_policy.filter_tools(all_tools)
    llm_chat = llm.bind_tools(chat_tools + [research_topic]) if chat_tools else llm

    _kwargs = dict(
        llm=llm, tools=tools, all_tools=all_tools, delegate_tools=delegate_tools,
        llm_plan=llm_plan, llm_chat=llm_chat,
        skill_context=skill_context, policy_mode=policy_mode,
        vendor=vendor, model=model,
    )

    def _agent(state: SpartaState):
        return agent_node(state, **_kwargs)

    def _tools(state: SpartaState):
        return tool_node(state, tools=tools)

    def _subagent(state: SpartaState):
        return subagent_node(state, llm=llm)

    def _reflection(state: SpartaState):
        return reflection_node_wrapped(state)

    graph = StateGraph(SpartaState)
    graph.add_node("agent", _agent)
    graph.add_node("tools", _tools)
    graph.add_node("subagent_coordinator", _subagent)
    graph.add_node("reflection", _reflection)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "subagent": "subagent_coordinator",
            "agent": "agent",
            "__end__": END,
        },
    )
    graph.add_conditional_edges(
        "tools",
        should_reflect,
        {
            "reflection": "reflection",
            "agent": "agent",
            "__end__": END,
        },
    )
    graph.add_edge("reflection", "agent")
    graph.add_edge("subagent_coordinator", "agent")

    return graph.compile(checkpointer=checkpointer)
