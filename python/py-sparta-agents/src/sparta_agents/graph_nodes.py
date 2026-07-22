import asyncio
import json
import logging
import time
from typing import Any

from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.prebuilt import ToolNode

from sparta_agents.graph_state import SpartaState
from sparta_agents.graph_helpers import (
    MAX_TOOL_CALLS_PER_TURN,
    get_dynamic_tools,
    _build_system_prompt,
    _build_messages,
    _detect_loop,
    should_continue,
)
from sparta_agents.subagents.research_agent import build_research_graph
from sparta_agents.subagents.code_agent import build_code_graph
from sparta_agents.subagents.memory_agent import build_memory_graph
from sparta_agents.subagents.review_agent import build_review_graph
from sparta_agents.reflection import reflection_node
from sparta_tools.plan_tool import create_plan_tool

logger = logging.getLogger("sparta_ai.agents.sparta")

__all__ = [
    "agent_node", "tool_node", "subagent_node", "reflection_node_wrapped",
    "should_continue", "MAX_TOOL_CALLS_PER_TURN", "get_dynamic_tools",
]


async def agent_node(state: SpartaState, *, llm: Any, tools: list, all_tools: list,
                     delegate_tools: list, llm_plan: Any, llm_chat: Any,
                     skill_context: str, policy_mode: str,
                     vendor: str, model: str) -> dict:
    from sparta_agents.router import classify_intent

    current_tool_calls = state.get("tool_calls_this_turn", 0)
    logger.debug("agent_node invoked: tool_calls_this_turn=%d/%d", current_tool_calls, MAX_TOOL_CALLS_PER_TURN)

    mode = state.get("mode", "chat")
    last_user_msg = ""
    for m in reversed(state.get("messages", [])):
        if isinstance(m, dict) and m.get("role") == "user":
            last_user_msg = m.get("content", "")
            break

    web_search_available = any(
        getattr(t, "name", None) in ("web_search_tool", "web_search") for t in tools
    )

    intent = classify_intent(last_user_msg, state.get("active_skills"), web_search_available=web_search_available)
    effective_mode = "agent" if mode == "agent" or intent != "chat" else "chat"

    dynamic_tools = get_dynamic_tools(all_tools, intent)
    llm_dynamic = llm.bind_tools(dynamic_tools + delegate_tools)

    system = _build_system_prompt(state, effective_mode, intent, policy_mode, skill_context, vendor, model)
    messages = _build_messages(state, system, skill_context)

    scope = "full"
    if effective_mode == "chat":
        scope = "chat"
    elif intent in ("research", "memory_query"):
        scope = "readonly"

    is_forced_summary = state.get("force_summary", False) or current_tool_calls >= MAX_TOOL_CALLS_PER_TURN
    if is_forced_summary:
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
            response = await llm_dynamic.ainvoke(messages)
    except Exception as e:
        err_str = str(e)
        if ("tool use" in err_str.lower() or "tools" in err_str.lower()) and "not found" in err_str.lower():
            error_msg = (
                "Error: El modelo seleccionado no soporta herramientas (tool use). "
                "Cambiá a un modelo que sí las soporte (Claude, GPT-4, Gemini Pro, etc.) "
                "en Configuración > Modelos."
            )
        elif "404" in err_str:
            error_msg = f"Error 404 del proveedor: {err_str[:200]}. Probablemente el modelo no existe o no soporta esta API."
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

    result: dict[str, Any] = {"messages": [response]}
    response_content = getattr(response, "content", "")
    if isinstance(response_content, str) and response_content:
        result["accumulated_text"] = state.get("accumulated_text", "") + response_content
    result["force_summary"] = False

    if not getattr(response, "tool_calls", None):
        async def _gen_suggestions():
            try:
                from sparta_tools.suggestions import generate_suggestions
                suggestions = await generate_suggestions(
                    llm,
                    user_query=last_user_msg,
                    llm_response=response.content if hasattr(response, "content") else "",
                )
                if suggestions:
                    result["suggestions"] = suggestions
            except Exception:
                logger.warning("suggestion generation failed", exc_info=True)
        asyncio.ensure_future(_gen_suggestions())

    return result


async def reflection_node_wrapped(state: SpartaState) -> dict:
    return await reflection_node(state)


async def tool_node(state: SpartaState, *, tools: list) -> dict:
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])
    if not tool_calls:
        return {"tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

    plan_calls = [tc for tc in tool_calls if tc.get("name") == "create_plan"]
    if plan_calls:
        plan_tc = plan_calls[0]
        steps = plan_tc.get("args", {}).get("steps", [])
        plan = [s.get("action", f"Paso {i+1}") for i, s in enumerate(steps)]
        return {
            "messages": [ToolMessage(
                content="Plan registrado. Los pasos se mostrarán en el panel de ejecución.",
                tool_call_id=plan_tc.get("id", ""),
                name="create_plan",
            )],
            "tool_calls_this_turn": state.get("tool_calls_this_turn", 0) + 1,
            "plan": plan,
            "current_step": 0,
            "plan_complete": False,
        }

    tool_node_exec = ToolNode(tools)
    result = await tool_node_exec.ainvoke(state)

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


async def subagent_node(state: SpartaState, *, llm: Any) -> dict:
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

    max_calls = MAX_TOOL_CALLS_PER_TURN - state.get("tool_calls_this_turn", 0)
    delegate_calls = delegate_calls[:max_calls]
    if max_calls <= 0:
        logger.warning("Tool call limit reached, skipping subagent delegation")
        return {"subagent_results": [], "tool_calls_this_turn": state.get("tool_calls_this_turn", 0)}

    async def _run_subagent(tc: dict) -> tuple[dict, ToolMessage]:
        from langchain_core.callbacks.manager import adispatch_custom_event

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
                "subagentName": subagent_name, "durationMs": 0, "success": False,
            })
            return (
                {"subagent": tc["name"], "error": "Unknown subagent type"},
                ToolMessage(content="Error: Tipo de subagente desconocido.", tool_call_id=tc.get("id", ""), name=tc["name"], status="error"),
            )

        t0 = time.monotonic()
        try:
            graph = builder(llm=llm)
            result = await asyncio.wait_for(
                graph.ainvoke({"messages": [HumanMessage(content=json.dumps(args))]}),
                timeout=120,
            )
            output = result.get("output") if isinstance(result, dict) else str(result)
            duration_ms = int((time.monotonic() - t0) * 1000)
            await adispatch_custom_event("subagent:completed", {
                "subagentName": subagent_name, "durationMs": duration_ms, "success": True,
            })
            return (
                {"subagent": tc["name"], "output": output},
                ToolMessage(content=str(output), tool_call_id=tc.get("id", ""), name=tc["name"]),
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.monotonic() - t0) * 1000)
            logger.warning("Subagent %s timed out after 120s", tc["name"])
            await adispatch_custom_event("subagent:completed", {
                "subagentName": subagent_name, "durationMs": duration_ms, "success": False,
            })
            return (
                {"subagent": tc["name"], "error": "Timeout after 120s"},
                ToolMessage(content="Error: El subagente excedió el tiempo de espera (120s).", tool_call_id=tc.get("id", ""), name=tc["name"], status="error"),
            )
        except Exception as e:
            duration_ms = int((time.monotonic() - t0) * 1000)
            logger.error("Subagent %s failed: %s", tc["name"], e)
            await adispatch_custom_event("subagent:completed", {
                "subagentName": subagent_name, "durationMs": duration_ms, "success": False,
            })
            return (
                {"subagent": tc["name"], "error": str(e)},
                ToolMessage(content=f"Error: {e}", tool_call_id=tc.get("id", ""), name=tc["name"], status="error"),
            )

    gathered = await asyncio.gather(*[_run_subagent(tc) for tc in delegate_calls])
    results = [r[0] for r in gathered]
    tool_messages = [r[1] for r in gathered]

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
