"""SqliteSaver configuration for LangGraph state persistence.

Provides a persistent checkpointer so the agent graph can resume across
sidecar restarts.
"""
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.persistence")


def get_checkpointer(data_dir: str | None = None) -> Any:
    """Return an AsyncSqliteSaver instance backed by a SQLite database on disk.

    Args:
        data_dir: Directory where the SQLite database is stored. If None,
            the SPARTA_DATA_DIR environment variable is used, falling back to
            ~/.sparta.
    """
    base = Path(
        data_dir
        or os.environ.get("SPARTA_DATA_DIR")
        or (Path.home() / ".sparta")
    )
    db_path = base / "agent_state.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        saver = AsyncSqliteSaver.from_conn_string(str(db_path))
        logger.info("SQLite checkpointer ready at %s", db_path)
        return saver
    except Exception as e:
        logger.warning("Failed to create SQLite checkpointer at %s: %s", db_path, e)
        raise
