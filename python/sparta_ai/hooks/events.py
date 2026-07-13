"""Supported hook event names."""

PRE_TOOL_USE = "PreToolUse"
POST_TOOL_USE = "PostToolUse"
SESSION_START = "SessionStart"
SESSION_STOP = "Stop"

SUPPORTED_EVENTS: set[str] = {
    PRE_TOOL_USE,
    POST_TOOL_USE,
    SESSION_START,
    SESSION_STOP,
}
