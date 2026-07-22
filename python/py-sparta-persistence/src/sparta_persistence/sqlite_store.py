"""SqliteSaver configuration for LangGraph state persistence."""
import logging
import os
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.persistence")

_exit_stack: AsyncExitStack | None = None
_saver_instance: Any = None


async def get_checkpointer(data_dir: str | None = None) -> Any:
    """Devuelve una instancia real de AsyncSqliteSaver (no el context manager).

    IMPORTANTE: esta funcion ahora es async y debe usarse con ``await``.
    Guarda la instancia en cache para no reabrir la conexion SQLite en
    cada mensaje - LangGraph reutiliza el mismo saver durante toda la
    vida del proceso del sidecar.
    """
    global _exit_stack, _saver_instance
    if _saver_instance is not None:
        return _saver_instance

    base = Path(
        data_dir
        or os.environ.get("SPARTA_DATA_DIR")
        or (Path.home() / ".sparta")
    )
    db_path = base / "agent_state.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)

    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

    _exit_stack = AsyncExitStack()
    _saver_instance = await _exit_stack.enter_async_context(
        AsyncSqliteSaver.from_conn_string(str(db_path))
    )
    logger.info("SQLite checkpointer ready at %s", db_path)
    return _saver_instance


async def close_checkpointer() -> None:
    """Cierra la conexion SQLite al apagar el sidecar."""
    global _exit_stack, _saver_instance
    if _exit_stack is not None:
        await _exit_stack.aclose()
    _exit_stack = None
    _saver_instance = None
