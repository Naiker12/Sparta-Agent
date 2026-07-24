"""Tool assembly — hooks, project context, and final tool list for the agent."""
import asyncio
import logging
import os

logger = logging.getLogger("sparta_ai.server_handlers")


def _wrap_tools_with_hooks(tools: list, workspace_root: str) -> list:
    """Wrap tools with lifecycle hooks if ``sparta.hooks.json`` exists.

    For each tool, if there are ``PreToolUse`` / ``PostToolUse`` hooks whose
    ``matcher`` matches the tool name, the original tool is wrapped so that
    hooks run before/after invocation.  If no hooks config exists or no hooks
    match, the tool is returned as-is (zero overhead).
    """
    from sparta_hooks.registry import load_hooks
    from sparta_hooks.runner import run_hooks
    from sparta_hooks.events import PRE_TOOL_USE, POST_TOOL_USE

    hooks_config = load_hooks(workspace_root)
    if not hooks_config:
        return tools

    pre_hooks = hooks_config.get(PRE_TOOL_USE, [])
    post_hooks = hooks_config.get(POST_TOOL_USE, [])
    if not pre_hooks and not post_hooks:
        return tools

    wrapped = []
    for t in tools:
        tool_name = getattr(t, "name", "") or ""

        # Check if any hook matches this tool
        has_pre = any(h.get("matcher", "") and tool_name for h in pre_hooks)
        has_post = any(h.get("matcher", "") and tool_name for h in post_hooks)
        if not has_pre and not has_post:
            wrapped.append(t)
            continue

        original_invoke = t.invoke
        original_ainvoke = t.ainvoke if hasattr(t, "ainvoke") else None

        def _make_sync_wrapper(tool_obj, tn):
            def _sync_wrapper(input_data):
                allowed, output = run_hooks(
                    pre_hooks, PRE_TOOL_USE, tool_name=tn,
                    tool_input=str(input_data)[:200], workspace_root=workspace_root,
                )
                if not allowed:
                    return f"Hook bloqueó la ejecución de '{tn}': {output}"
                result = original_invoke(input_data)
                run_hooks(
                    post_hooks, POST_TOOL_USE, tool_name=tn,
                    tool_input=str(input_data)[:200], workspace_root=workspace_root,
                )
                return result
            return _sync_wrapper

        def _make_async_wrapper(tool_obj, tn, orig_async):
            async def _async_wrapper(input_data):
                allowed, output = await asyncio.to_thread(
                    run_hooks, pre_hooks, PRE_TOOL_USE, tn, str(input_data)[:200], workspace_root,
                )
                if not allowed:
                    return f"Hook bloqueó la ejecución de '{tn}': {output}"
                result = await orig_async(input_data)
                await asyncio.to_thread(
                    run_hooks, post_hooks, POST_TOOL_USE, tn, str(input_data)[:200], workspace_root,
                )
                return result
            return _async_wrapper

        t.invoke = _make_sync_wrapper(t, tool_name)
        if original_ainvoke:
            t.ainvoke = _make_async_wrapper(t, tool_name, original_ainvoke)
        wrapped.append(t)

    return wrapped


_project_context_cache: dict[str, tuple[float, str]] = {}


def _build_project_context(workspace_root: str) -> str:
    """Build a brief project context string from the workspace root.

    Detects the stack by checking for common config files and counts
    files by extension.  Returns a 10-15 line summary for the system prompt.
    Caches result for 60 seconds per workspace.
    """
    import time
    now = time.time()
    cached = _project_context_cache.get(workspace_root)
    if cached and (now - cached[0] < 60.0):
        return cached[1]

    from pathlib import Path

    root = Path(workspace_root)
    if not root.exists():
        return ""

    lines = [f"Raíz: {root.name}"]

    # Detect stack
    stack = []
    if (root / "package.json").exists():
        stack.append("Node.js")
    if (root / "pyproject.toml").exists() or (root / "setup.py").exists():
        stack.append("Python")
    if (root / "Cargo.toml").exists():
        stack.append("Rust")
    if (root / "go.mod").exists():
        stack.append("Go")
    if (root / "pom.xml").exists() or (root / "build.gradle").exists():
        stack.append("Java")
    if (root / "*.csproj").exists() or list(root.glob("*.sln")):
        stack.append(".NET")
    if stack:
        lines.append(f"Stack: {', '.join(stack)}")

    # Count files by extension (top 3 levels only, pruning heavy folders)
    ext_counts: dict[str, int] = {}
    file_count = 0
    skip_dirs = {
        "node_modules", ".git", ".venv", "venv", "env", "target", ".cargo",
        "__pycache__", ".pytest_cache", "dist", "build", ".next", ".out",
        "out", ".nuxt", ".idea", ".vscode", "dist-electron", "dist-web",
        "release", ".ruff_cache", ".sparta", ".agents", "vendor", "tmp", "temp"
    }

    def walk_dir(path: Path, depth: int = 0):
        nonlocal file_count
        if file_count > 2000 or depth > 3:
            return
        try:
            for item in path.iterdir():
                if item.is_dir():
                    if item.name in skip_dirs or item.name.startswith("."):
                        continue
                    walk_dir(item, depth + 1)
                elif item.is_file():
                    file_count += 1
                    ext = item.suffix.lower()
                    if ext:
                        ext_counts[ext] = ext_counts.get(ext, 0) + 1
                    if file_count > 2000:
                        break
        except (PermissionError, OSError):
            pass

    try:
        walk_dir(root)
    except Exception:
        pass

    if file_count:
        lines.append(f"Archivos: ~{file_count}")

    # Top extensions
    top_exts = sorted(ext_counts.items(), key=lambda x: -x[1])[:5]
    if top_exts:
        ext_str = ", ".join(f"{ext}({cnt})" for ext, cnt in top_exts)
    res = "\n".join(lines)
    _project_context_cache[workspace_root] = (now, res)
    return res


def _assemble_agent_tools(
    read_only: bool,
    web_search_enabled: bool,
    mcp_tools: list,
    session_id: str = "",
    policy_mode: str = "build",
) -> list:
    from sparta_tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_tools.file_tools import (
        read_file_tool, read_files_tool, write_file_tool, search_files_tool,
        patch_file_tool, delete_file_tool, inject_workspace_guidance,
    )
    from sparta_tools.patch_tools import apply_patch_tool
    from sparta_tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
    from sparta_tools.terminal_tools import (
        terminal_execute_tool, terminal_execute_background_tool, terminal_check_tool, get_open_files_tool,
    )
    from sparta_tools.mcp_manage_tool import mcp_manage_tool
    from sparta_tools.diagnostics_tool import get_diagnostics_tool

    inject_workspace_guidance()

    # apply_patch_tool lives in patch_tools.py; inject workspace guidance here
    # to avoid circular imports between file_tools.py and patch_tools.py.
    try:
        from sparta_tools.file_tools import _workspace_guidance as _ws_guidance
        _guidance = _ws_guidance()
    except RuntimeError:
        _guidance = ""
    if _guidance:
        apply_patch_tool.description = (
            f"{apply_patch_tool.description}\n\n{_guidance}"
        )

    if read_only:
        tools = [
            read_memory_tool,
            read_file_tool, read_files_tool, search_files_tool,
            skill_view_tool, skills_list_tool,
            get_diagnostics_tool,
            terminal_check_tool,
            get_open_files_tool,
        ]
    else:
        tools = [
            read_memory_tool, write_memory_tool,
            read_file_tool, read_files_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
            apply_patch_tool,
            skill_view_tool, skills_list_tool, skill_manage_tool,
            terminal_execute_tool, terminal_execute_background_tool,
            mcp_manage_tool,
            get_diagnostics_tool,
            terminal_check_tool,
            get_open_files_tool,
        ]

    tools.extend(mcp_tools)

    if web_search_enabled:
        from sparta_tools.web_search import web_search_tool
        from sparta_tools.web_fetch import web_fetch_tool
        tools.insert(0, web_search_tool)
        tools.insert(1, web_fetch_tool)

    # Apply CONFIG_ONLY mode filter: only skill/MCP management tools
    if policy_mode == "config_only":
        from sparta_tools.mcp_manage_tool import mcp_manage_tool as _mcp_tool
        config_tools = [
            skill_view_tool, skills_list_tool, skill_manage_tool,
            _mcp_tool,
        ]
        if web_search_enabled:
            config_tools.insert(0, web_search_tool)
        logger.info(
            "CONFIG_ONLY mode: filtering %d tools down to %d config tools",
            len(tools), len(config_tools),
        )
        tools = config_tools

    # Wrap tools with lifecycle hooks if configured
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if session_id:
        from sparta_handlers.workspace import get_session_workspace
        workspace_root = get_session_workspace(session_id) or workspace_root
    if workspace_root:
        tools = _wrap_tools_with_hooks(tools, workspace_root)

    return tools
