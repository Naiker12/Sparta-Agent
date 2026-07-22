"""Backward-compatible shim — all logic moved to sparta_ai.tools.file package.

This module re-exports everything so that existing imports like
``from sparta_tools.file_tools import read_file_tool`` continue to work.
"""
from sparta_tools.file import (  # noqa: F401
    set_session_workspace,
    clear_session_workspace,
    _get_workspace_root,
    _workspace_root,
    _get_safe_path,
    _validate_path,
    _workspace_guidance,
    _move_to_trash,
    _emit_file_changed,
    _check_rate_limit,
    inject_workspace_guidance,
    read_file_tool,
    read_files_tool,
    write_file_tool,
    patch_file_tool,
    search_files_tool,
    delete_file_tool,
    DENYLIST_FILES,
    BLOCKED_FILE_PATTERNS,
    BLOCKED_PATH_COMPONENTS,
    _MAX_PATH_LENGTH,
    _MAX_CONTENT_SIZE,
    _SKIP_DIRS,
)
