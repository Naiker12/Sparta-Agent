import json
import operator
import logging
from typing import Annotated, Any, Literal

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.types import Command

from sparta_ai.agents.subagents.research_agent import research_topic, build_research_graph
from sparta_ai.agents.subagents.code_agent import execute_code_task, build_code_graph
from sparta_ai.agents.subagents.memory_agent import recall_memories, build_memory_graph
from sparta_ai.agents.planner import planner_node
from sparta_ai.agents.reflection import reflection_node, should_reflect

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
    plan: list[str]
    current_step: int
    plan_complete: bool
    reflection_retries: int


def build_sparta_graph(
    llm: Any,
    tools: list,
    skill_context: str = "",
    memory_context: str = "",
    checkpointer: Any | None = None,
) -> StateGraph:
    # Include delegate tools so the LLM can decide to hand off to sub-graphs.
    delegate_tools = [research_topic, execute_code_task, recall_memories]
    llm_with_tools = llm.bind_tools(tools + delegate_tools)

    async def agent_node(state: SpartaState) -> dict:
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
            "",
            "REGLAS CRÍTICAS PARA FECHA/HORA ACTUAL:",
            "- NUNCA respondas preguntas sobre la fecha, hora o día actual usando tu conocimiento de entrenamiento.",
            "- Tu conocimiento tiene una fecha de corte y NO sabes la fecha actual real.",
            "- Para preguntas sobre 'qué día es', 'qué fecha es hoy', usa web_search.",
            "- Si web_search no está disponible o falla, di: 'No tengo acceso a la fecha actual. Revisa la fecha en tu dispositivo o activa la búsqueda web.'",
            "- NUNCA digas 'según mi conocimiento, hoy es...' porque es información incorrecta.",
            "",
            "REGLAS PARA HERRAMIENTAS:",
            "- Usa web_search MÁXIMO UNA VEZ por query. Si la búsqueda ya devolvió resultados, no la repitas.",
            "- Si una herramienta falla, informa al usuario del error específico.",
            "- No invoques la misma herramienta con los mismos argumentos más de una vez.",
            "- Si una tool devuelve un ERROR, NO inventes la respuesta — reporta el error al usuario.",
            "",
            "REGLAS PARA RESPUESTAS CON BÚSQUEDA WEB:",
            "- Cuando uses web_search, el usuario YA VE el progreso de búsqueda y las URLs visitadas en tiempo real en la interfaz.",
            "- NUNCA repitas la lista de resultados, URLs, títulos ni snippets de la búsqueda en tu respuesta final.",
            "- NO digas frases como: 'Basándome en los resultados de búsqueda...', 'He buscado en internet y encontré...', 'Según mi búsqueda web...'.",
            "- Usa la información encontrada para responder DIRECTAMENTE la pregunta del usuario, como si ya supieras la respuesta.",
            "- Tu respuesta debe ser una síntesis clara y directa, NO un resumen de los resultados de búsqueda.",
            "- Si quieres citar una fuente, menciona el nombre del sitio brevemente (ej: 'según MDN...') pero NO incluyas URLs completas ni listas de enlaces.",
            "",
            "FORMATO DE RESPUESTA:",
            "- Usa Markdown solo cuando sea necesario (código, tablas, listas de pasos).",
            "- En respuestas conversacionales cortas, responde en texto plano.",
            "- Evita ## headings para respuestas normales de chat.",
            "- Las listas deben usar '-' sin líneas en blanco entre items.",
            "",
            "EJEMPLOS DE FORMATO:",
            "BIEN (lista compacta):",
            "- Primer item",
            "- Segundo item",
            "- Tercer item",
            "",
            "MAL (no hagas esto):",
            "- Primer item",
            "",
            "- Segundo item",
            "",
            "- Tercer item",
            "",
            "MAL (no uses headings para respuestas simples):",
            "## Respuesta",
            "Esto es una respuesta simple.",
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

        system = "\n\n".join(system_parts)

        # Build message list: system prompt + active skills as user message + history
        messages: list[dict] = [
            {"role": "system", "content": system},
        ]

        # Inject active skills as a user message (preserves system prompt prefix cache)
        if skill_context:
            messages.append({
                "role": "user",
                "content": f"[Active skills loaded]\n\n{skill_context}\n\n"
                           f"Follow the active skills listed above. Use skills_list_tool to explore "
                           f"more skills, and skill_view_tool to load their full content.",
            })

        messages.extend(state["messages"])

        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    async def planner_node_wrapped(state: SpartaState) -> dict:
        return await planner_node(state, llm)

    async def reflection_node_wrapped(state: SpartaState) -> dict:
        return await reflection_node(state)

    async def tool_node(state: SpartaState) -> dict:
        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])
        if not tool_calls:
            return {"tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        from langgraph.prebuilt import ToolNode
        tool_node_exec = ToolNode(tools)
        result = await tool_node_exec.ainvoke(state)
        return {
            "messages": result.get("messages", []),
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + len(tool_calls),
        }

    async def subagent_node(state: SpartaState) -> dict:
        from langchain_core.messages import ToolMessage

        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])
        delegate_calls = [tc for tc in tool_calls if tc.get("name", "").startswith("delegate_")]

        if not delegate_calls:
            return {"subagent_results": [], "tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        subagent_map = {
            "delegate_research": build_research_graph,
            "delegate_code": build_code_graph,
            "delegate_memory": build_memory_graph,
        }

        results = []
        tool_messages = []
        for tc in delegate_calls:
            builder = subagent_map.get(tc["name"])
            if not builder:
                continue
            try:
                graph = builder()
                args = tc.get("args", {})
                # Compiled sub-graphs stream their internal events automatically
                # through the parent graph's astream_events thanks to their namespace.
                result = await graph.ainvoke({"messages": [HumanMessage(content=json.dumps(args))]})
                output = result.get("output") if isinstance(result, dict) else str(result)
                results.append({"subagent": tc["name"], "output": output})
                tool_messages.append(ToolMessage(
                    content=str(output),
                    tool_call_id=tc.get("id", ""),
                    name=tc["name"],
                ))
            except Exception as e:
                logger.error("Subagent %s failed: %s", tc["name"], e)
                error_msg = str(e)
                results.append({"subagent": tc["name"], "error": error_msg})
                tool_messages.append(ToolMessage(
                    content=f"Error: {error_msg}",
                    tool_call_id=tc.get("id", ""),
                    name=tc["name"],
                ))

        return {
            "messages": tool_messages,
            "subagent_results": results,
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0),
        }

    MAX_TOOL_CALLS_PER_TURN = 8

    def _detect_loop(state: SpartaState) -> bool:
        messages = state.get("messages", [])
        seen_queries: set[str] = set()
        for msg in messages[-6:]:
            tool_calls = getattr(msg, "tool_calls", [])
            for tc in tool_calls:
                query = str(tc.get("args", {}).get("query", ""))
                if query in seen_queries:
                    return True
                if query:
                    seen_queries.add(query)
        return False

    def should_continue(state: SpartaState) -> Literal["tools", "subagent", "__end__"]:
        if state.get("abort_requested"):
            return "__end__"

        if state.get("tool_calls_this_turn", 0) >= MAX_TOOL_CALLS_PER_TURN:
            logger.warning("Tool call limit reached (%s), ending turn", MAX_TOOL_CALLS_PER_TURN)
            return "__end__"

        if _detect_loop(state):
            logger.warning("Loop detected: same query repeated in recent tool calls, ending turn")
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
    graph.add_node("planner", planner_node_wrapped)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("subagent_coordinator", subagent_node)
    graph.add_node("reflection", reflection_node_wrapped)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "subagent": "subagent_coordinator",
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

