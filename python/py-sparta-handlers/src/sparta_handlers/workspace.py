"""Shared session/workspace state used by server.py, server_web.py and agent modules."""
import asyncio

_active_streams: dict[str, asyncio.Task] = {}
_session_workspaces: dict[str, str] = {}


def set_session_workspace(session_id: str, root: str) -> None:
    _session_workspaces[session_id] = root
    from sparta_tools.file_tools import set_session_workspace as _set_ws
    _set_ws(session_id, root)


def get_session_workspace(session_id: str) -> str:
    return _session_workspaces.get(session_id, "")
