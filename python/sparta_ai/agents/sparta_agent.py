import asyncio
import json
import operator
import logging
from datetime import datetime
from typing import Annotated, Any, Literal

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.types import Command

from sparta_ai.agents.subagents.research_agent import research_topic, build_research_graph
from sparta_ai.agents.subagents.code_agent import execute_code_task, build_code_graph
from sparta_ai.agents.subagents.memory_agent import recall_memories, build_memory_graph
from sparta_ai.agents.reflection import reflection_node, should_reflect
from sparta_ai.security.permission_policy import PermissionPolicy, get_policy, set_policy_mode
from sparta_ai.tools.plan_tool import create_plan_tool

logger = logging.getLogger("sparta_ai.agents.sparta")

MAX_TOOL_CALLS_PER_TURN = 8


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
    force_summary: bool
    accumulated_text: str
    plan: list[str]
    current_step: int
    plan_complete: bool
    reflection_retries: int
    suggestions: list[str]


def build_sparta_graph(
    llm: Any,
    tools: list,
    skill_context: str = "",
    memory_context: str = "",
    checkpointer: Any | None = None,
    policy_mode: str = "build",
    vendor: str = "openai",
) -> StateGraph:
    # Apply permission policy to tools
    set_policy_mode(policy_mode)
    policy = PermissionPolicy(mode=policy_mode)
    all_tools = tools + [create_plan_tool]
    delegate_tools = [research_topic, execute_code_task, recall_memories]

    # Create two LLM bindings: one for build mode (all tools), one for plan mode (read-only)
    llm_with_tools = llm.bind_tools(all_tools + delegate_tools)
    plan_tools = policy.filter_tools(all_tools)
    llm_plan = llm.bind_tools(plan_tools + delegate_tools) if plan_tools else llm

    async def agent_node(state: SpartaState) -> dict:
        from sparta_ai.agents.router import classify_intent

        # ── Instrumentation: log how many times LLM is called per turn ──
        current_tool_calls = state.get("tool_calls_this_turn", 0)
        logger.debug(
            "agent_node invoked: tool_calls_this_turn=%d/%d",
            current_tool_calls, MAX_TOOL_CALLS_PER_TURN,
        )

        mode = state.get("mode", "chat")
        last_user_msg = ""
        for m in reversed(state.get("messages", [])):
            if isinstance(m, dict) and m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        # Detect if web_search is available in the current tool list (closure over `tools`)
        # LangChain 0.3+ @tool strips "_tool" suffix, so name may be "web_search"
        web_search_available = any(
            getattr(t, "name", None) in ("web_search_tool", "web_search")
            for t in tools
        )

        intent = classify_intent(last_user_msg, state.get("active_skills"), web_search_available=web_search_available)
        effective_mode = "agent" if mode == "agent" or intent != "chat" else "chat"

        system_parts = [
            f"Fecha y hora actual del sistema: {datetime.now().isoformat()}",
            "",
            "Eres Sparta Agent, un orquestador de agentes de IA.",
            "Tienes acceso a herramientas para buscar en web, leer/escribir archivos,",
            "consultar memoria, y conectar con servidores MCP externos.",
            "",
            "REGLAS CRÍTICAS PARA DATOS EN VIVO:",
            "- Tu fecha y hora del sistema se inyectan automáticamente en este prompt (arriba).",
            "- Para preguntas sobre 'qué día es', 'qué fecha es hoy', 'qué hora es', 'qué día de la semana es': RESPONDE DIRECTAMENTE usando la fecha del sistema. NO invoques web_search_tool.",
            "- NUNCA respondas preguntas sobre la fecha, hora o día actual usando tu conocimiento de entrenamiento — usa la fecha del sistema inyectada.",
            "- Para preguntas sobre resultados deportivos en vivo (fútbol, tenis, etc.), quién va ganando, marcadores, o eventos actuales: DEBES invocar web_search_tool — tu conocimiento de entrenamiento no tiene esta información.",
            "- Para clima, noticias, precios actualizados, cotizaciones: DEBES invocar web_search_tool — esta información cambia constantemente.",
            "- No respondas con 'no tengo información actualizada' si web_search_tool está disponible — úsala siempre para datos en tiempo real que no estén en la fecha del sistema.",
            "",
            "REGLAS PARA HERRAMIENTAS:",
            "- No invoques la misma herramienta con los mismos argumentos más de una vez (evita loops).",
            "- Si una herramienta falla, informa al usuario del error específico.",
            "- Si una tool devuelve un ERROR, NO inventes la respuesta — reporta el error al usuario.",
            "",
            "REGLAS PARA RESPUESTAS CON BÚSQUEDA WEB:",
            "- web_search_tool te da snippets; si necesitas el contenido completo de una fuente, usa web_fetch_tool.",
            "- Para investigaciones complejas, usa delegate_research (modo 'deep') para múltiples búsquedas, lectura de páginas y síntesis con citas.",
            "- Cuando uses web_search_tool, el usuario YA VE el progreso de búsqueda y las URLs visitadas en tiempo real en la interfaz.",
            "- NUNCA repitas la lista de resultados, URLs, títulos ni snippets de la búsqueda en tu respuesta final.",
            "- NO digas frases como: 'Basándome en los resultados de búsqueda...', 'He buscado en internet y encontré...', 'Según mi búsqueda web...'.",
            "- Usa la información encontrada para responder DIRECTAMENTE la pregunta del usuario, como si ya supieras la respuesta.",
            "- Tu respuesta debe ser una síntesis clara y directa, NO un resumen de los resultados de búsqueda.",
            "- Si quieres citar una fuente, menciona el nombre del sitio brevemente (ej: 'según MDN...') pero NO incluyas URLs completas ni listas de enlaces.",
            "",
            "REGLAS PARA PLANIFICACIÓN:",
            "- Para tareas complejas de varios pasos, usa la herramienta create_plan",
            "  para registrar tu plan. El panel 'Plan de ejecución' lo mostrará.",
            "- NUNCA incluyas JSON de planificación en tu respuesta al usuario.",
            "- Si usas <think> o <reasoning> tags, el contenido se mostrará como",
            "  'Pensando...' y no contaminará tu respuesta visible.",
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
                    "\nIntención detectada: INVESTIGACIÓN. Usa web_search_tool para buscar "
                    "información actualizada, y delegate_research para investigación profunda."
                )
            elif intent == "memory_query":
                system_parts.append(
                    "\nIntención detectada: CONSULTA DE MEMORIA. Usa read_memory para "
                    "recuperar información almacenada."
                )
        else:
            if web_search_available:
                system_parts.append(
                "\nModo: CHAT — Responde de forma conversacional y directa. "
                "Tienes web_search_tool disponible: ÚSALA para cualquier pregunta sobre "
                "fechas, noticias, datos actuales, resultados deportivos en vivo, "
                "o cuando el usuario pida buscar algo. No necesitas permiso especial para invocarla en modo chat."
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

        # Deduplicate messages: only replace consecutive exact-duplicate
        # assistant responses so the LLM retains real multi-turn context.
        raw_messages = state["messages"]
        deduped = []
        for i, m in enumerate(raw_messages):
            if isinstance(m, dict):
                role = m.get("role", "")
                content = m.get("content", "")
                tool_calls = m.get("tool_calls", [])
            else:
                role = getattr(m, "type", "")
                content = str(getattr(m, "content", ""))
                tool_calls = getattr(m, "tool_calls", None) or []
            is_dup = False
            if role in ("assistant", "ai") and not tool_calls and content:
                # Check if the previous message is identical
                if deduped:
                    prev = deduped[-1]
                    prev_content = prev.get("content", "") if isinstance(prev, dict) else str(getattr(prev, "content", ""))
                    if prev_content == content:
                        is_dup = True
            if is_dup:
                deduped.append({
                    "role": "assistant",
                    "content": "[Respuesta anterior — omitida para evitar repetición]",
                })
            else:
                deduped.append(m)
        messages.extend(deduped)

        # Scope tools by intent/mode (Build vs Plan pattern)
        scope = "full"
        if effective_mode == "chat":
            scope = "chat"
        elif intent == "research":
            scope = "readonly"
        elif intent == "memory_query":
            scope = "readonly"

        # Detect forced summary mode: tool limit reached or loop detected
        is_forced_summary = state.get("force_summary", False) or state.get("tool_calls_this_turn", 0) >= MAX_TOOL_CALLS_PER_TURN
        if is_forced_summary:
            # Use plain LLM without tools so it can't make more tool calls
            # and must produce a final summary response
            messages.append({
                "role": "system",
                "content": (
                    "Has alcanzado el límite de herramientas para este turno. "
                    "NO puedes hacer más llamadas a herramientas ahora. "
                    "Resume lo que lograste hasta el momento, qué información "
                    "obtuviste, y qué recomiendas como siguiente paso. "
                    "Sé conciso y directo."
                ),
            })
        try:
            if is_forced_summary:
                response = await llm.ainvoke(messages)
            elif scope == "readonly" or policy_mode == "plan":
                response = await llm_plan.ainvoke(messages)
            else:
                response = await llm_with_tools.ainvoke(messages)
        except Exception as e:
            err_str = str(e)
            if ("tool use" in err_str.lower() or "tools" in err_str.lower()) and "not found" in err_str.lower():
                error_msg = (
                    "Error: El modelo seleccionado no soporta herramientas (tool use). "
                    "Cambiá a un modelo que sí las soporte (Claude, GPT-4, Gemini Pro, etc.) "
                    "en Configuración > Modelos."
                )
            elif "404" in err_str:
                error_msg = (
                    f"Error 404 del proveedor: {err_str[:200]}. "
                    "Probablemente el modelo no existe o no soporta esta API."
                )
            elif any(kw in err_str.lower() for kw in ("429", "too many requests", "resource_exhausted", "quota exceeded", "rate_limit")):
                error_msg = (
                    "⚠️ ** Cuota de API agotada **\n\n"
                    "El proveedor de IA ha alcanzado su límite de uso diario.\n\n"
                    "**Opciones:**\n"
                    "1. Cambia a otro modelo en Configuración > Modelos\n"
                    "2. Espera a que se restablezca la cuota (suele ser diaria)\n"
                    "3. Usa un modelo local (Ollama/LM Studio) para no depender de APIs externas"
                )
                logger.warning("API quota exhausted for provider: %s", err_str[:200])
            else:
                error_msg = f"Error del modelo: {err_str[:300]}"
            return {"messages": [{"role": "assistant", "content": error_msg}], "force_summary": False}

        # Build result dict
        result: dict[str, Any] = {"messages": [response]}
        # Track accumulated text for deduplication
        response_content = getattr(response, "content", "")
        if isinstance(response_content, str) and response_content:
            prev = state.get("accumulated_text", "")
            result["accumulated_text"] = prev + response_content
        result["force_summary"] = False

        # Generate contextual follow-up suggestions on the FINAL response
        # (no pending tool calls means this is the actual answer).
        if not getattr(response, "tool_calls", None):
            try:
                from sparta_ai.tools.suggestions import generate_suggestions
                suggestions = await generate_suggestions(
                    llm,
                    user_query=last_user_msg,
                    llm_response=response.content if hasattr(response, "content") else "",
                )
                if suggestions:
                    result["suggestions"] = suggestions
            except Exception:
                logger.warning("suggestion generation failed", exc_info=True)

        return result

    async def reflection_node_wrapped(state: SpartaState) -> dict:
        return await reflection_node(state)

    async def tool_node(state: SpartaState) -> dict:
        from langchain_core.messages import ToolMessage

        last_message = state["messages"][-1]
        tool_calls = getattr(last_message, "tool_calls", [])
        if not tool_calls:
            return {"tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        # Intercept create_plan calls — they update state["plan"] instead of running a real tool
        plan_calls = [tc for tc in tool_calls if tc.get("name") == "create_plan"]
        if plan_calls:
            plan_tc = plan_calls[0]
            steps = plan_tc.get("args", {}).get("steps", [])
            plan = [s.get("action", f"Paso {i+1}") for i, s in enumerate(steps)]
            plan_messages = [
                ToolMessage(
                    content="Plan registrado. Los pasos se mostrarán en el panel de ejecución.",
                    tool_call_id=plan_tc.get("id", ""),
                    name="create_plan",
                )
            ]
            return {
                "messages": plan_messages,
                "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + 1,
                "plan": plan,
                "current_step": 0,
                "plan_complete": False,
            }

        from langgraph.prebuilt import ToolNode
        tool_node_exec = ToolNode(tools)
        result = await tool_node_exec.ainvoke(state)

        # Increment plan step counter for each tool executed
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        plan_complete = state.get("plan_complete", True)
        if plan:
            current_step = min(current_step + len(tool_calls), len(plan))
            plan_complete = current_step >= len(plan)

        return {
            "messages": result.get("messages", []),
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + len(tool_calls),
            "current_step": current_step,
            "plan": plan,
            "plan_complete": plan_complete,
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

        # Apply tool call limit BEFORE launching parallel subagents
        max_calls = MAX_TOOL_CALLS_PER_TURN - state.get("tool_calls_this_turn", 0)
        delegate_calls = delegate_calls[:max_calls]
        if max_calls <= 0:
            logger.warning("Tool call limit reached, skipping subagent delegation")
            return {"subagent_results": [], "tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        async def _run_subagent(tc: dict) -> tuple[dict, ToolMessage]:
            builder = subagent_map.get(tc["name"])
            if not builder:
                return (
                    {"subagent": tc["name"], "error": "Unknown subagent type"},
                    ToolMessage(
                        content="Error: Tipo de subagente desconocido.",
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                        status="error",
                    ),
                )
            try:
                graph = builder(llm=llm)
                args = tc.get("args", {})
                # Compiled sub-graphs stream their internal events automatically
                # through the parent graph's astream_events thanks to their namespace.
                result = await asyncio.wait_for(
                    graph.ainvoke({"messages": [HumanMessage(content=json.dumps(args))]}),
                    timeout=120,
                )
                output = result.get("output") if isinstance(result, dict) else str(result)
                return (
                    {"subagent": tc["name"], "output": output},
                    ToolMessage(
                        content=str(output),
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                    ),
                )
            except asyncio.TimeoutError:
                logger.warning("Subagent %s timed out after 120s", tc["name"])
                return (
                    {"subagent": tc["name"], "error": "Timeout after 120s"},
                    ToolMessage(
                        content="Error: El subagente excedió el tiempo de espera (120s).",
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                        status="error",
                    ),
                )
            except Exception as e:
                logger.error("Subagent %s failed: %s", tc["name"], e)
                error_msg = str(e)
                return (
                    {"subagent": tc["name"], "error": error_msg},
                    ToolMessage(
                        content=f"Error: {error_msg}",
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                        status="error",
                    ),
                )

        # Run all subagents in parallel, preserving order
        gathered = await asyncio.gather(*[_run_subagent(tc) for tc in delegate_calls])
        results = [r[0] for r in gathered]
        tool_messages = [r[1] for r in gathered]

        # Increment plan step counter for each subagent executed
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        plan_complete = state.get("plan_complete", True)
        if plan:
            current_step = min(current_step + len(delegate_calls), len(plan))
            plan_complete = current_step >= len(plan)

        return {
            "messages": tool_messages,
            "subagent_results": results,
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + 1,
            "current_step": current_step,
            "plan": plan,
            "plan_complete": plan_complete,
        }

    @staticmethod
    def _detect_loop(state: SpartaState) -> bool:
        messages = state.get("messages", [])
        seen_signatures: set[str] = set()
        # Check last 20 messages (covers multi-turn conversations)
        for msg in messages[-20:]:
            tool_calls = getattr(msg, "tool_calls", [])
            for tc in tool_calls:
                args = tc.get("args", {})
                if isinstance(args, dict):
                    key_fields = [args.get(f, "") for f in ("query", "command", "path", "file_path", "url", "pattern", "content")]
                    key_text = "|".join(str(k) for k in key_fields if k)
                else:
                    key_text = str(args)
                if key_text and key_text in seen_signatures:
                    return True
                if key_text:
                    seen_signatures.add(key_text)
        return False

    def should_continue(state: SpartaState) -> Literal["tools", "subagent", "agent", "__end__"]:
        if state.get("abort_requested"):
            return "__end__"

        if state.get("tool_calls_this_turn", 0) >= MAX_TOOL_CALLS_PER_TURN:
            logger.warning("Tool call limit reached (%s), forcing final synthesis", MAX_TOOL_CALLS_PER_TURN)
            return "agent"

        if _detect_loop(state):
            logger.warning("Loop detected: same query repeated in recent tool calls, forcing final synthesis")
            return "agent"

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
    graph.add_node("reflection", reflection_node_wrapped)

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

