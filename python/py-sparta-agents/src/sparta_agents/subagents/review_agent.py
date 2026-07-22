import json
import logging

from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode

from sparta_tools.file_tools import read_file_tool, search_files_tool
from sparta_tools.code_search_tools import (
    list_directory_tool,
    glob_search_tool,
    grep_search_tool,
    git_status_tool,
)

logger = logging.getLogger("sparta_ai.subagents.review")


class ReviewState(MessagesState):
    paths: list[str]
    focus: str
    output: str


REVIEW_PROMPT = (
    "Eres un agente de revisión de código. Analiza uno o más archivos y "
    "reporta problemas de calidad, seguridad o inconsistencias.\n\n"
    "REGLAS:\n"
    "- NO modifiques ningún archivo — solo lees y analizas.\n"
    "- Sé específico: menciona archivo, línea y problema.\n"
    "- Prioriza: errores críticos > vulnerabilidades > bugs potenciales > estilo.\n"
    "- Si todo está bien, dilo brevemente.\n"
    "- Responde en español."
)


def _extract_review_args(messages: list[BaseMessage]) -> tuple[list[str], str]:
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    paths = parsed.get("paths", [])
                    if isinstance(paths, str):
                        paths = [paths]
                    return paths, parsed.get("focus", "general")
            except json.JSONDecodeError:
                pass
            return [], "general"
    return [], "general"


@tool("delegate_review")
def review_changes(
    paths: list[str],
    focus: str = "general",
) -> str:
    """
    Delega en el subagente de revisión: analiza uno o más archivos y
    reporta problemas de calidad, seguridad, o inconsistencias — sin
    modificar nada (read-only por diseño).

    Args:
        paths: Archivos a revisar (usualmente los tocados en este turno).
        focus: 'general' | 'security' | 'performance' | 'style'.

    Returns:
        Confirmación de que la tarea será delegada al subagente de revisión.
    """
    return f"Delegando revisión al subagente (focus={focus}, archivos={len(paths)}): {', '.join(p.split('/')[-1] for p in paths[:5])}"


def build_review_graph(llm=None):
    """Return a compiled LangGraph sub-graph that streams through the parent.

    Args:
        llm: LLM instance from the parent graph. Must be provided.
    """
    if llm is None:
        raise ValueError(
            "build_review_graph: se requiere una instancia de LLM."
        )

    tools = [
        read_file_tool,
        list_directory_tool,
        glob_search_tool,
        grep_search_tool,
        git_status_tool,
        search_files_tool,
    ]
    llm_with_tools = llm.bind_tools(tools)

    async def agent_node(state: ReviewState) -> dict:
        paths, focus = _extract_review_args(state["messages"])
        await adispatch_custom_event("thinking:status", {"text": "Revisando código..."})

        focus_instructions = {
            "security": "Enfócate en vulnerabilidades, inyecciones, permisos inseguros, secrets expuestos.",
            "performance": "Enfócate en ineficiencias, O(n²) innecesarios, memory leaks, allocations innecesarias.",
            "style": "Enfócate en convenciones del proyecto, nombres consistentes, complejidad innecesaria.",
            "general": "Revisa calidad general: bugs potenciales, manejo de errores, claridad, seguridad.",
        }
        prompt = REVIEW_PROMPT + "\n\n" + focus_instructions.get(focus, focus_instructions["general"])

        file_contexts = []
        for path in paths[:10]:
            try:
                content = read_file_tool.invoke({"path": path})
                file_contexts.append(f"=== {path} ===\n{content[:3000]}")
            except Exception as e:
                file_contexts.append(f"=== {path} === (error leyendo: {e})")

        system = SystemMessage(content=prompt)
        user = "Archivos a revisar:\n\n" + "\n\n".join(file_contexts) if file_contexts else "No se proporcionaron archivos."
        response = await llm_with_tools.ainvoke([system, user])
        return {"messages": [response], "paths": paths, "focus": focus}

    async def tool_node(state: ReviewState) -> dict:
        exec_node = ToolNode(tools)
        result = await exec_node.ainvoke(state)
        return result

    def should_continue(state: ReviewState) -> str:
        last = state["messages"][-1]
        if getattr(last, "tool_calls", []):
            return "tools"
        return "output"

    def output_node(state: ReviewState) -> dict:
        last = state["messages"][-1]
        return {"output": getattr(last, "content", str(last))}

    graph = StateGraph(ReviewState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("output", output_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "output": "output"})
    graph.add_edge("tools", "agent")
    graph.add_edge("output", END)

    return graph.compile()
