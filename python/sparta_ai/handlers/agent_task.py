"""run_agent_task() — autonomous sub-agent execution with its own LLM loop."""
import json
import logging
import re
import time
from typing import Callable, Optional

from sparta_ai.handlers.workspace import _session_workspaces

logger = logging.getLogger("sparta_ai.server_handlers")


async def run_agent_task(
    *,
    request_id: Optional[str],
    task_id: str,
    agent_id: str,
    task_description: str,
    system_prompt: str,
    allowed_tools: list[str],
    model: str,
    provider: str,
    vendor: str,
    provider_key: Optional[str],
    api_url: Optional[str],
    workspace_root: str,
    agent_autonomy: str,
    max_turns: int,
    emit_fn: Callable[[Optional[str], str, dict], None],
) -> None:
    """Run a sub-agent task with its own LLM loop, streaming steps back via emit_fn."""
    from sparta_ai.config.providers import build_llm
    from sparta_ai.tools.permission_broker import set_agent_autonomy
    set_agent_autonomy(agent_autonomy)

    if workspace_root:
        _session_workspaces[task_id] = workspace_root
        from sparta_ai.tools.file_tools import set_session_workspace
        set_session_workspace(task_id, workspace_root)

    try:
        llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=provider_key, api_url=api_url)

        from sparta_ai.tools.file_tools import (
            read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
        )
        from sparta_ai.tools.patch_tools import apply_patch_tool
        from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_check_tool
        from sparta_ai.tools.memory_tools import read_memory_tool
        from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

        all_tools_map = {
            "read_file": read_file_tool, "write_file": write_file_tool,
            "search_files": search_files_tool, "patch_file": patch_file_tool,
            "apply_patch": apply_patch_tool,
            "delete_file": delete_file_tool,
            "terminal_execute": terminal_execute_tool, "terminal_check": terminal_check_tool,
            "read_memory": read_memory_tool, "get_diagnostics": get_diagnostics_tool,
        }

        active_tools = [all_tools_map[t] for t in allowed_tools if t in all_tools_map]

        messages = [{"role": "user", "content": task_description}]
        accumulated = ""

        for turn in range(max_turns):
            tool_descs = "\n".join(f"- {t.name}: {t.description}" for t in active_tools)

            prompt = (
                f"{system_prompt}\n\n"
                f"## Herramientas disponibles\n"
                f"Puedes usar las siguientes herramientas. Cuando necesites usar una, responde con:\n"
                f"<tool_use>\n<tool_name>nombre</tool_name>\n<tool_input>{{json}}</tool_input>\n</tool_use>\n\n"
                f"{tool_descs}\n\n"
                f"## Conversación\n"
            )
            for msg in messages:
                prompt += f"\n{msg['role'].upper()}: {msg['content']}"
            prompt += "\n\nASSISTANT: "

            from langchain_core.messages import HumanMessage
            response_msg = await llm.ainvoke([HumanMessage(content=prompt)])
            response = response_msg.content if hasattr(response_msg, "content") else str(response_msg)
            messages.append({"role": "assistant", "content": response})

            tool_blocks = re.findall(
                r"<tool_use>\s*<tool_name>([\w-]+)</tool_name>\s*<tool_input>([\s\S]*?)</tool_input>\s*</tool_use>",
                response,
            )

            if not tool_blocks:
                result_match = re.search(r"<result>([\s\S]*?)</result>", response)
                accumulated = result_match.group(1).strip() if result_match else response.strip()
                break

            for idx, (tname, tinput_str) in enumerate(tool_blocks):
                step_id = f"step-{turn}-{tname.lower()}-{idx}"
                emit_fn(request_id, "agent:step", {
                    "task_id": task_id,
                    "agent_id": agent_id,
                    "step_id": step_id,
                    "tool_name": tname,
                    "status": "running",
                })

                try:
                    try:
                        tinput = json.loads(tinput_str)
                    except json.JSONDecodeError:
                        tinput = tinput_str

                    tool_fn = all_tools_map.get(tname)
                    if not tool_fn:
                        raise ValueError(f"Tool '{tname}' not in allowed tools")

                    t0 = time.monotonic()
                    tool_result = await tool_fn.ainvoke(tinput) if hasattr(tool_fn, "ainvoke") else tool_fn.invoke(tinput)
                    duration_ms = int((time.monotonic() - t0) * 1000)

                    emit_fn(request_id, "agent:step", {
                        "task_id": task_id,
                        "agent_id": agent_id,
                        "step_id": step_id,
                        "tool_name": tname,
                        "status": "completed",
                        "duration_ms": duration_ms,
                    })

                    messages.append({"role": "user", "content": f"Resultado de {tname} ({duration_ms}ms): {tool_result}"})
                except Exception as e:
                    emit_fn(request_id, "agent:step", {
                        "task_id": task_id,
                        "agent_id": agent_id,
                        "step_id": step_id,
                        "tool_name": tname,
                        "status": "error",
                        "error": str(e),
                    })
                    messages.append({"role": "user", "content": f"Resultado de {tname}: ERROR: {e}"})

        if turn >= max_turns - 1:
            accumulated = "Límite de turnos alcanzado.\n" + accumulated

        emit_fn(request_id, "agent:completed", {
            "task_id": task_id,
            "agent_id": agent_id,
            "result": accumulated,
        })

    except Exception as e:
        logger.exception("Agent task failed for %s", task_id)
        emit_fn(request_id, "agent:error", {
            "task_id": task_id,
            "agent_id": agent_id,
            "error": str(e),
        })

    finally:
        if workspace_root:
            _session_workspaces.pop(task_id, None)
            from sparta_ai.tools.file_tools import clear_session_workspace
            clear_session_workspace(task_id)
