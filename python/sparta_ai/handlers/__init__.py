"""Punto de entrada único para server.py y server_web.py.
No mover ni renombrar sin actualizar esos dos archivos."""

from .workspace import (
    _active_streams,
    _session_workspaces,
    set_session_workspace,
    get_session_workspace,
)
from .memory_handlers import (
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
)
from .mcp_handlers import handle_mcp_test
from .agent_stream import run_agent_stream
from .agent_task import run_agent_task

__all__ = [
    "_active_streams", "_session_workspaces",
    "set_session_workspace", "get_session_workspace",
    "handle_memory_index", "handle_memory_search", "handle_memory_embed",
    "handle_memory_delete", "handle_memory_count",
    "handle_mcp_test", "run_agent_stream", "run_agent_task",
]
