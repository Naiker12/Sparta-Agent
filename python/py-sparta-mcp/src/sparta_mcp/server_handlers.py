"""Backward-compatibility shim — all logic lives in sparta_handlers."""
from sparta_handlers.workspace import (  # noqa: F401
    _active_streams,
    _session_workspaces,
    set_session_workspace,
)
from sparta_handlers.memory_handlers import (  # noqa: F401
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
)
from sparta_handlers.mcp_handlers import handle_mcp_test  # noqa: F401
from sparta_handlers.agent_stream import run_agent_stream  # noqa: F401
from sparta_handlers.agent_task import run_agent_task  # noqa: F401
