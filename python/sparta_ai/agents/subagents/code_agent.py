import json
import logging
from typing import TypedDict

from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode

from sparta_ai.tools.file_tools import (
    read_file_tool,
    write_file_tool,
    patch_file_tool,
    delete_file_tool,
    search_files_tool,
)
from sparta_ai.tools.code_search_tools import (
    list_directory_tool,
    glob_search_tool,
    grep_search_tool,
    git_status_tool,
)

logger = logging.getLogger("sparta_ai.subagents.code")


class CodeState(MessagesState):
    task: str
    language: str
    file_path: str | None
    output: str


CODE_PROMPT = (
    "Eres un agente de programación experto. Antes de escribir o modificar "
    "código en un proyecto que no conoces, sigue SIEMPRE este orden:\n"
    "1. list_directory en la raíz para entender la estructura.\n"
    "2. Lee package.json / pyproject.toml / Cargo.toml / requirements.txt "
    "(el que exista) para identificar el stack y las dependencias.\n"
    "3. Usa grep_search o glob_search para localizar el código relevante "
    "a la tarea (no adivines rutas).\n"
    "4. Antes de escribir, muestra qué archivo vas a tocar y por qué.\n"
    "5. Después de escribir, si el proyecto tiene git, usa git_status "
    "para confirmar el alcance real del cambio.\n"
    "Nunca toques node_modules/, .git/, .env, ni archivos fuera del "
    "workspace del proyecto. Explica siempre los cambios que haces y "
    "sigue las convenciones ya presentes en el código (no inventes un "
    "estilo nuevo si el proyecto ya tiene uno)."
)


def _extract_task_args(messages: list[BaseMessage]) -> tuple[str, str, str | None]:
    """Extract code task parameters from the last user/system message."""
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    return (
                        parsed.get("task", content),
                        parsed.get("language", "auto"),
                        parsed.get("file_path"),
                    )
            except json.JSONDecodeError:
                pass
            return content, "auto", None
    return "", "auto", None


@tool("delegate_code")
def execute_code_task(
    task: str,
    language: str = "auto",
    file_path: str | None = None,
) -> str:
    """
    Señala al orquestador que se debe activar el subagente de código.
    El trabajo real lo realiza el subagente compilado (build_code_graph)
    con el LLM que el usuario configuró, no esta función.

    Args:
        task: Descripción de la tarea de código a realizar.
        language: Lenguaje de programación (python, javascript, typescript, etc.).
                 Usar 'auto' para detección automática.
        file_path: Ruta opcional al archivo a modificar o analizar.

    Returns:
        Confirmación de que la tarea será delegada al subagente de código.
    """
    # This tool is intentionally lightweight: the parent graph intercepts
    # delegate_* tool calls and runs the compiled sub-graph with the active
    # user-selected LLM. Keeping this function free of side-effects prevents
    # accidentally using a fallback model.
    return f"Delegando tarea de código al subagente (lenguaje={language}, archivo={file_path}): {task[:200]}"


def _build_code_agent(llm=None):
    if llm is None:
        raise ValueError(
            "code_agent: se requiere una instancia de LLM. "
            "No se permite un modelo hardcodeado."
        )
    tools = [
        list_directory_tool,
        glob_search_tool,
        grep_search_tool,
        git_status_tool,
        read_file_tool,
        write_file_tool,
        patch_file_tool,
        delete_file_tool,
        search_files_tool,
    ]
    prompt = CODE_PROMPT
    from langchain.agents import create_react_agent
    return create_react_agent(llm, tools, prompt=prompt)


def build_code_graph(llm=None):
    """Return a compiled LangGraph sub-graph that streams through the parent.

    Args:
        llm: LLM instance from the parent graph. Must be provided; the subagent
             will use the user's configured provider/model instead of a fallback.
    """
    if llm is None:
        raise ValueError(
            "build_code_graph: se requiere una instancia de LLM. "
            "Asegurate de que el subagente reciba el modelo activo del usuario."
        )
    tools = [
        list_directory_tool,
        glob_search_tool,
        grep_search_tool,
        git_status_tool,
        read_file_tool,
        write_file_tool,
        patch_file_tool,
        delete_file_tool,
        search_files_tool,
    ]
    llm_with_tools = llm.bind_tools(tools)

    async def agent_node(state: CodeState) -> dict:
        task, language, file_path = _extract_task_args(state["messages"])
        await adispatch_custom_event("thinking:status", {"text": "Explorando el código y planificando cambios…"})
        system = SystemMessage(content=CODE_PROMPT)
        prompt_parts = [f"Tarea: {task}"]
        if language and language != "auto":
            prompt_parts.append(f"Lenguaje: {language}")
        if file_path:
            try:
                context = read_file_tool.invoke({"path": file_path})
                prompt_parts.append(f"Contexto del archivo:\n{context}")
            except Exception as e:
                prompt_parts.append(f"(No se pudo leer {file_path}: {e})")
        user = "\n".join(prompt_parts)
        response = await llm_with_tools.ainvoke([system, *state["messages"], user])
        return {"messages": [response], "task": task, "language": language, "file_path": file_path}

    async def tool_node(state: CodeState) -> dict:
        exec_node = ToolNode(tools)
        result = await exec_node.ainvoke(state)
        return result

    def should_continue(state: CodeState) -> str:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", [])
        if tool_calls:
            return "tools"
        return "output"

    def output_node(state: CodeState) -> dict:
        last = state["messages"][-1]
        return {"output": getattr(last, "content", str(last))}

    graph = StateGraph(CodeState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("output", output_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "output": "output"},
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("output", END)

    return graph.compile()
