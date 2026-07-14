import asyncio
import json
import operator
import logging
import platform
from datetime import datetime
from typing import Annotated, Any, Literal

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.types import Command

from sparta_ai.agents.subagents.research_agent import research_topic, build_research_graph
from sparta_ai.agents.subagents.code_agent import execute_code_task, build_code_graph
from sparta_ai.agents.subagents.memory_agent import recall_memories, build_memory_graph
from sparta_ai.agents.subagents.review_agent import review_changes, build_review_graph
from sparta_ai.agents.reflection import reflection_node, should_reflect
from sparta_ai.security.permission_policy import PermissionPolicy, get_policy, set_policy_mode
from sparta_ai.tools.plan_tool import create_plan_tool

logger = logging.getLogger("sparta_ai.agents.sparta")


def _os_shell_hint() -> str:
    """Describe el SO real del usuario para que terminal_execute_tool genere
    comandos válidos. Sin esto, el modelo asume Unix por defecto y genera
    combinaciones rotas como 'dir ... | head -50' en Windows."""
    system = platform.system()
    if system == "Windows":
        return (
            "Windows (cmd.exe/PowerShell). Usa SOLO comandos nativos de Windows: "
            "'dir' (no 'ls'), 'type' (no 'cat'), 'findstr' (no 'grep'), 'del' (no 'rm'). "
            "NUNCA uses 'head', 'tail', 'grep', 'ls', 'cat', 'wc' ni pipes de estilo Unix — "
            "no existen en cmd.exe y el comando fallará. Para limitar líneas de salida en "
            "PowerShell usa 'Select-Object -First N', NO '| head -N'."
        )
    if system == "Darwin":
        return "macOS (zsh/bash). Podés usar comandos Unix estándar: ls, head, tail, grep, cat, etc."
    return "Linux (bash). Podés usar comandos Unix estándar: ls, head, tail, grep, cat, etc."

MAX_TOOL_CALLS_PER_TURN = 8


class SpartaState(MessagesState):
    session_id: str
    mode: Literal["chat", "agent"]
    active_skills: list[str]
    memory_context: str
    project_context: str
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
    model: str = "",
) -> StateGraph:
    # Apply permission policy to tools
    set_policy_mode(policy_mode)
    policy = PermissionPolicy(mode=policy_mode)
    all_tools = tools + [create_plan_tool]
    delegate_tools = [research_topic, execute_code_task, recall_memories, review_changes]

    # Create LLM bindings: build (all tools), plan (read-only), chat (read+web+memory)
    llm_with_tools = llm.bind_tools(all_tools + delegate_tools)
    plan_tools = policy.filter_tools(all_tools)
    llm_plan = llm.bind_tools(plan_tools + delegate_tools) if plan_tools else llm
    chat_policy = PermissionPolicy(mode="chat")
    chat_tools = chat_policy.filter_tools(all_tools)
    llm_chat = llm.bind_tools(chat_tools + [research_topic]) if chat_tools else llm

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
            "# Sparta Agent",
            "Sos el orquestador de agentes de IA integrado en Sparta, un asistente de "
            "escritorio para desarrollo de software. Trabajás directamente sobre el "
            "proyecto que el usuario tiene abierto en el editor: podés leer, buscar, "
            "y — solo en modo Agente — editar, crear y borrar archivos, además de "
            "ejecutar comandos de terminal y delegar en subagentes especializados.",
            "",
            "## Contexto del sistema",
            f"- Sistema operativo: {_os_shell_hint()}",
        ]

        if state.get("project_context"):
            system_parts.append(
                f"- Proyecto abierto:\n<proyecto_actual>\n{state['project_context']}\n</proyecto_actual>"
            )

        system_parts += [
            "",
            f"## Modo activo: {'AGENTE' if effective_mode == 'agent' else 'CHAT'}",
        ]

        if effective_mode == "agent":
            system_parts.append(
                "Tenés acceso completo a herramientas de lectura, escritura, borrado "
                "y ejecución de comandos sobre el proyecto abierto. Descomponé tareas "
                "complejas en pasos verificables; usá create_plan para tareas de más "
                "de 2-3 pasos antes de empezar a ejecutar."
            )
            if intent == "code_task":
                system_parts.append(
                    "Intención detectada: TAREA DE CÓDIGO. Usa read_file/write_file "
                    "para leer/escribir archivos, y delegate_code para tareas complejas."
                )
            elif intent == "research":
                system_parts.append(
                    "Intención detectada: INVESTIGACIÓN. Usa web_search/web_fetch "
                    "o delegate_research para investigación profunda."
                )
            elif intent == "memory_query":
                system_parts.append(
                    "Intención detectada: CONSULTA DE MEMORIA. Usa read_memory para "
                    "recuperar información almacenada."
                )
        else:
            system_parts.append(
                "Estás en modo conversacional. NO tenés herramientas de escritura, "
                "borrado ni terminal disponibles — solo lectura, búsqueda y memoria. "
                "Si el usuario pide un cambio en el código, respondé qué harías y sugerí "
                "cambiar a modo Agente para ejecutarlo; no lo prometas como si ya estuviera hecho."
            )
            if web_search_available:
                system_parts.append(
                    "Tenés web_search_tool disponible: usala para preguntas sobre "
                    "fechas, noticias, datos actuales, o cuando el usuario pida buscar algo."
                )

        system_parts += [
            "",
            "## Reglas operativas",
            "- Nunca inventes el resultado de una tool: si falla, reportá el error real.",
            "- No repitas una tool con los mismos argumentos si ya falló (evitá loops).",
            "- Para un cambio puntual usá patch_file_tool; para cambios coordinados en "
            "2+ archivos, apply_patch_tool (atómico).",
            "- Después de cambios no triviales, delegá en delegate_review antes de "
            "responder que terminaste.",
            "- Si necesitás leer varios archivos, usá read_files_tool en vez de read_file_tool repetido.",
            "",
            "## Datos en vivo",
            "- Fecha/hora: usá siempre la del contexto temporal inyectado, nunca la "
            "respondas de memoria ni la busques en la web.",
            "- Deportes en vivo, clima, noticias, cotizaciones: usá web_search_tool "
            "siempre — tu conocimiento no tiene esta información.",
            "- No respondas 'no tengo información actualizada' si web_search_tool está disponible.",
            "",
            "## Terminal",
            "- Generá comandos válidos para el SO indicado arriba, nunca asumas Unix.",
            "- Si el comando falla, corrige el motivo específico (sintaxis, ruta, SO).",
            "",
            "## Búsqueda web",
            "- web_search_tool da snippets; para contenido completo, usá web_fetch_tool.",
            "- Para investigaciones complejas, delegá en delegate_research (modo 'deep').",
            "- NUNCA repitas la lista de resultados, URLs ni snippets en tu respuesta final.",
            "- Respondé DIRECTAMENTE la pregunta, como si ya supieras la respuesta.",
            "- Citá fuentes brevemente ('según MDN...') sin URLs completas.",
            "",
            "## Planificación",
            "- Para tareas de 2+ pasos, usá create_plan para registrar el plan.",
            "- NUNCA incluyas JSON de planificación en tu respuesta al usuario.",
            "",
            "## Formato de respuesta",
            "- Markdown solo cuando sea necesario (código, tablas, listas de pasos).",
            "- En respuestas conversacionales cortas, texto plano.",
            "- Listas con '-' sin líneas en blanco entre items.",
        ]

        if state.get("memory_context"):
            system_parts.append(
                f"\n<memoria_relevante>\n{state['memory_context']}\n</memoria_relevante>"
            )

        system = "\n\n".join(system_parts)

        # For models without native reasoning, inject the emulated thinking
        # prompt so the model wraps its reasoning in think/thinking tags.
        # The StreamingThinkScrubber in event_bridge.py already strips these
        # and emits them as thinking:token events for the frontend.
        if vendor and model:
            from sparta_ai.agents.emulated_reasoning import (
                needs_emulated_reasoning,
                append_reasoning_prompt,
            )
            if needs_emulated_reasoning(vendor, model):
                system = append_reasoning_prompt(system)

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

        # Inject timestamp as a separate user message (not in system prompt)
        # so the system prompt prefix remains cacheable by the provider.
        messages.append({
            "role": "user",
            "content": f"[Contexto temporal] Fecha/hora actual: {datetime.now().isoformat()}",
        })

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
            elif scope == "chat":
                response = await llm_chat.ainvoke(messages)
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
        # Run non-blocking so suggestions don't delay the response.
        if not getattr(response, "tool_calls", None):
            async def _gen_suggestions():
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
            import asyncio
            asyncio.ensure_future(_gen_suggestions())

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
            "delegate_review": build_review_graph,
        }

        # Apply tool call limit BEFORE launching parallel subagents
        max_calls = MAX_TOOL_CALLS_PER_TURN - state.get("tool_calls_this_turn", 0)
        delegate_calls = delegate_calls[:max_calls]
        if max_calls <= 0:
            logger.warning("Tool call limit reached, skipping subagent delegation")
            return {"subagent_results": [], "tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

        async def _run_subagent(tc: dict) -> tuple[dict, ToolMessage]:
            from langchain_core.callbacks.manager import adispatch_custom_event
            import time

            subagent_name = tc["name"].replace("delegate_", "")
            args = tc.get("args", {})
            task_summary = json.dumps(args)[:200]
            await adispatch_custom_event("subagent:started", {
                "subagentName": subagent_name,
                "taskSummary": task_summary,
            })

            builder = subagent_map.get(tc["name"])
            if not builder:
                await adispatch_custom_event("subagent:completed", {
                    "subagentName": subagent_name,
                    "durationMs": 0,
                    "success": False,
                })
                return (
                    {"subagent": tc["name"], "error": "Unknown subagent type"},
                    ToolMessage(
                        content="Error: Tipo de subagente desconocido.",
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                        status="error",
                    ),
                )
            t0 = time.monotonic()
            try:
                graph = builder(llm=llm)
                # Compiled sub-graphs stream their internal events automatically
                # through the parent graph's astream_events thanks to their namespace.
                result = await asyncio.wait_for(
                    graph.ainvoke({"messages": [HumanMessage(content=json.dumps(args))]}),
                    timeout=120,
                )
                output = result.get("output") if isinstance(result, dict) else str(result)
                duration_ms = int((time.monotonic() - t0) * 1000)
                await adispatch_custom_event("subagent:completed", {
                    "subagentName": subagent_name,
                    "durationMs": duration_ms,
                    "success": True,
                })
                return (
                    {"subagent": tc["name"], "output": output},
                    ToolMessage(
                        content=str(output),
                        tool_call_id=tc.get("id", ""),
                        name=tc["name"],
                    ),
                )
            except asyncio.TimeoutError:
                duration_ms = int((time.monotonic() - t0) * 1000)
                logger.warning("Subagent %s timed out after 120s", tc["name"])
                await adispatch_custom_event("subagent:completed", {
                    "subagentName": subagent_name,
                    "durationMs": duration_ms,
                    "success": False,
                })
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
                duration_ms = int((time.monotonic() - t0) * 1000)
                logger.error("Subagent %s failed: %s", tc["name"], e)
                error_msg = str(e)
                await adispatch_custom_event("subagent:completed", {
                    "subagentName": subagent_name,
                    "durationMs": duration_ms,
                    "success": False,
                })
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
