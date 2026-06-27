import operator
import logging
from typing import Annotated, Any, Literal

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.types import Command

logger = logging.getLogger("sparta_ai.agents.sparta")


class SpartaState(MessagesState):
    session_id: str
    mode: Literal["chat", "agent"]
    active_skills: list[str]
    memory_context: str
    thinking_tokens: int
    tool_calls_this_turn: int
    subagent_results: Annotated[list, operator.add]
    pending_human_input: str | None
    abort_requested: bool


def build_sparta_graph(
    llm: Any,
    tools: list,
    skill_context: str = "",
    memory_context: str = "",
) -> StateGraph:
    llm_with_tools = llm.bind_tools(tools)

    def agent_node(state: SpartaState) -> dict:
        from sparta_ai.agents.router import classify_intent

        mode = state.get("mode", "chat")
        last_user_msg = ""
        for m in reversed(state.get("messages", [])):
            if isinstance(m, dict) and m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        intent = classify_intent(last_user_msg, state.get("active_skills"))
        effective_mode = "agent" if mode == "agent" or intent != "chat" else "chat"

        system_parts = [
            "Eres Sparta Agent, un orquestador de agentes de IA.",
            "Tienes acceso a herramientas para buscar en web, leer/escribir archivos,",
            "consultar memoria, y conectar con servidores MCP externos.",
        ]

        if effective_mode == "agent":
            system_parts.append(
                "\nModo: AGENTE — Puedes usar todas las herramientas disponibles "
                "para completar la tarea del usuario. Descompón problemas complejos "
                "en pasos y usa las herramientas apropiadas."
            )
            if intent == "code_task":
                system_parts.append(
                    "\nIntención detectada: TAREA DE CÓDIGO. Usa read_file/write_file "
                    "para leer/escribir archivos, y delegate_code para tareas complejas."
                )
            elif intent == "research":
                system_parts.append(
                    "\nIntención detectada: INVESTIGACIÓN. Usa web_search para buscar "
                    "información actualizada, y delegate_research para investigación profunda."
                )
            elif intent == "memory_query":
                system_parts.append(
                    "\nIntención detectada: CONSULTA DE MEMORIA. Usa read_memory para "
                    "recuperar información almacenada."
                )
        else:
            system_parts.append(
                "\nModo: CHAT — Responde de forma conversacional y directa. "
                "Usa herramientas solo cuando sea estrictamente necesario."
            )

        if state.get("memory_context"):
            system_parts.append(
                f"\n<memoria_relevante>\n{state['memory_context']}\n</memoria_relevante>"
            )
        if skill_context:
            system_parts.append(f"\n{skill_context}")

        system = "\n\n".join(system_parts)

        response = llm_with_tools.invoke([
            {"role": "system", "content": system},
            *state["messages"],
        ])
        return {"messages": [response]}

    def tool_node(state: SpartaState) -> dict:
        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])
        if not tool_calls:
            return {"tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        from langgraph.prebuilt import ToolNode
        tool_node_exec = ToolNode(tools)
        result = tool_node_exec.invoke(state)
        return {
            "messages": result.get("messages", []),
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + len(tool_calls),
        }

    def subagent_node(state: SpartaState) -> dict:
        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])
        delegate_calls = [tc for tc in tool_calls if tc.get("name", "").startswith("delegate_")]

        results = []
        for tc in delegate_calls:
            from sparta_ai.agents.subagents.research_agent import research_topic
            from sparta_ai.agents.subagents.code_agent import execute_code_task
            from sparta_ai.agents.subagents.memory_agent import recall_memories

            subagent_map = {
                "delegate_research": research_topic,
                "delegate_code": execute_code_task,
                "delegate_memory": recall_memories,
            }
            fn = subagent_map.get(tc["name"])
            if fn:
                try:
                    result = fn.invoke(tc.get("args", {}))
                    results.append(result)
                except Exception as e:
                    logger.error("Subagent %s failed: %s", tc["name"], e)
                    results.append({"error": str(e)})

        return {"subagent_results": results, "tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

    def should_continue(state: SpartaState) -> Literal["tools", "subagent", "__end__"]:
        if state.get("abort_requested"):
            return "__end__"

        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])

        if tool_calls:
            for tc in tool_calls:
                if tc.get("name", "").startswith("delegate_"):
                    return "subagent"
            return "tools"

        return "__end__"

    graph = StateGraph(SpartaState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("subagent_coordinator", subagent_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "subagent": "subagent_coordinator",
            "__end__": END,
        },
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("subagent_coordinator", "agent")

    return graph.compile()


def _build_system_prompt(state: SpartaState, skill_context: str = "", memory_context: str = "") -> str:
    parts = [
        "Eres Sparta Agent, un orquestador de agentes de IA.",
        "Tienes acceso a herramientas para buscar en web, leer/escribir archivos,",
        "consultar memoria, y conectar con servidores MCP externos.",
        "",
        "Cuando recibas una tarea compleja:",
        "  1. Descompón el problema en pasos.",
        "  2. Usa las herramientas apropiadas para cada paso.",
        "  3. Si necesitas investigación profunda, delega a un subagente.",
        "  4. Si necesitas manipular archivos, usa las herramientas de archivo.",
        "  5. Sintetiza los resultados en una respuesta clara.",
    ]

    if state.get("mode") == "chat":
        parts.append("\nModo: CHAT — Responde de forma conversacional.")
    elif state.get("mode") == "agent":
        parts.append("\nModo: AGENTE — Puedes usar todas las herramientas disponibles.")

    if memory_context:
        parts.append(f"\n<memoria_relevante>\n{memory_context}\n</memoria_relevante>")

    if skill_context:
        parts.append(f"\n{skill_context}")

    return "\n\n".join(parts)
