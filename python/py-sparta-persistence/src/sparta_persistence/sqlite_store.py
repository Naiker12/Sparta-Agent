"""SqliteSaver configuration for LangGraph state persistence."""
import logging
import os
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.persistence")

_db_path: str | None = None
_exit_stacks: list[AsyncExitStack] = []


def _resolve_db_path(data_dir: str | None = None) -> str:
    """Resolve and cache the database file path."""
    global _db_path
    if _db_path is not None:
        return _db_path
    base = Path(
        data_dir
        or os.environ.get("SPARTA_DATA_DIR")
        or (Path.home() / ".sparta")
    )
    db = base / "agent_state.db"
    db.parent.mkdir(parents=True, exist_ok=True)
    _db_path = str(db)
    return _db_path


async def get_checkpointer(data_dir: str | None = None) -> Any:
    """Return a fresh AsyncSqliteSaver instance via a new AsyncExitStack.

    Creates a NEW saver + exit stack each time to avoid the aiosqlite
    'threads can only be started once' RuntimeError that occurs
    when reusing a cached AsyncSqliteSaver across multiple
    graph.astream_events() calls.
    """
    db_path = _resolve_db_path(data_dir)

    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

    stack = AsyncExitStack()
    saver = await stack.enter_async_context(
        AsyncSqliteSaver.from_conn_string(db_path)
    )
    _exit_stacks.append(stack)
    logger.info("SQLite checkpointer ready at %s", db_path)
    return saver


async def close_checkpointer() -> None:
    """Close all active SQLite checkpointer connections."""
    global _exit_stacks
    for stack in _exit_stacks:
        try:
            await stack.aclose()
        except Exception:
            pass
    _exit_stacks.clear()
