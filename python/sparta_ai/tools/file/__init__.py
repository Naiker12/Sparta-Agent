"""File tools package — re-exports for backward compatibility.

All imports from sparta_ai.tools.file_tools continue to work unchanged.
"""
from sparta_ai.tools.file.workspace_paths import (
    set_session_workspace,
    clear_session_workspace,
    _get_workspace_root,
    _workspace_root,
    _get_safe_path,
    _validate_path,
    _workspace_guidance,
    _move_to_trash,
    _emit_file_changed,
    DENYLIST_FILES,
    BLOCKED_FILE_PATTERNS,
    BLOCKED_PATH_COMPONENTS,
    _MAX_PATH_LENGTH,
    _MAX_CONTENT_SIZE,
    _SKIP_DIRS,
)
from sparta_ai.tools.file.rate_limit import _check_rate_limit
from sparta_ai.tools.file.read_tools import read_file_tool, read_files_tool
from sparta_ai.tools.file.write_tools import write_file_tool, patch_file_tool
from sparta_ai.tools.file.search_tool import search_files_tool
from sparta_ai.tools.file.delete_tools import delete_file_tool

__all__ = [
    "set_session_workspace",
    "clear_session_workspace",
    "_get_workspace_root",
    "_workspace_root",
    "_get_safe_path",
    "_validate_path",
    "_workspace_guidance",
    "_move_to_trash",
    "_emit_file_changed",
    "_check_rate_limit",
    "read_file_tool",
    "read_files_tool",
    "write_file_tool",
    "patch_file_tool",
    "search_files_tool",
    "delete_file_tool",
    "DENYLIST_FILES",
    "BLOCKED_FILE_PATTERNS",
    "BLOCKED_PATH_COMPONENTS",
    "_MAX_PATH_LENGTH",
    "_MAX_CONTENT_SIZE",
    "_SKIP_DIRS",
]


def inject_workspace_guidance() -> None:
    """Update all tool descriptions with the current workspace root."""
    guidance = _workspace_guidance()
    read_file_tool.description = (
        f"{read_file_tool.__original_description}\n\n{guidance}"  # type: ignore[attr-defined]
    )
    write_file_tool.description = (
        f"{write_file_tool.__original_description}\n\n{guidance}\n"  # type: ignore[attr-defined]
        "Si la escritura falla, informa el error al usuario y no pegues el archivo completo en el chat."
    )
    for _t in (search_files_tool, patch_file_tool, delete_file_tool, read_files_tool):
        _t.description = f"{_t.__original_description}\n\n{guidance}"  # type: ignore[attr-defined]


# Bootstrap: save originals once, then inject current workspace
_ALL_FILE_TOOLS = (read_file_tool, read_files_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool)
for _t in _ALL_FILE_TOOLS:
    _t.__original_description = _t.description  # type: ignore[attr-defined]
inject_workspace_guidance()
