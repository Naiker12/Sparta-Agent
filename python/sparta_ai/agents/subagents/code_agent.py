import json
import logging
from typing import TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode

from sparta_ai.tools.file_tools import read_file_tool, write_file_tool

logger = logging.getLogger("sparta_ai.subagents.code")


class CodeState(MessagesState):
    task: str
    language: str
    file_path: str | None
    output: str


CODE_PROMPT = (
    "Eres un agente de programación experto. Tu tarea es escribir, "
    "refactorizar y depurar código. Siempre explica los cambios que haces "
    "y sigue las mejores prácticas del lenguaje correspondiente."
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


@tool
def execute_code_task(
    task: str,
    language: str = "auto",
    file_path: str | None = None,
) -> str:
    """
    Ejecuta tareas de programación: escribir código, refactorizar,
    depurar, o analizar archivos de código fuente.

    Args:
        task: Descripción de la tarea de código a realizar.
        language: Lenguaje de programación (python, javascript, typescript, etc.).
                 Usar 'auto' para detección automática.
        file_path: Ruta opcional al archivo a modificar o analizar.

    Returns:
        Código generado o modificado, con explicación de los cambios.
    """
    context = ""
    if file_path:
        try:
            context = read_file_tool.invoke({"path": file_path})
        except Exception as e:
            context = f"(No se pudo leer {file_path}: {e})"

    prompt_parts = [f"Tarea: {task}"]
    if language and language != "auto":
        prompt_parts.append(f"Lenguaje: {language}")
    if context:
        prompt_parts.append(f"Contexto del archivo:\n{context}")

    agent = _build_code_agent()
    result = agent.invoke({"input": "\n".join(prompt_parts)})
    return result.get("output", str(result))


def _build_code_agent():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    tools = [read_file_tool, write_file_tool]
    prompt = (
        "Eres un agente de programación experto. Tu tarea es escribir, "
        "refactorizar y depurar código. Siempre explica los cambios que haces "
        "y sigue las mejores prácticas del lenguaje correspondiente."
    )
    from langchain.agents import create_react_agent
    return create_react_agent(llm, tools, prompt=prompt)


def build_code_graph():
    """Return a compiled LangGraph sub-graph that streams through the parent."""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    tools = [read_file_tool, write_file_tool]
    llm_with_tools = llm.bind_tools(tools)

    async def agent_node(state: CodeState) -> dict:
        task, language, file_path = _extract_task_args(state["messages"])
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
