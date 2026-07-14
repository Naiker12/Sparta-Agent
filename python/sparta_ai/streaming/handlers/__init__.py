"""Event handlers package — dispatch table for LangGraph events.

Each handler has the signature:
    async def handler(emit_fn, emit_control_fn, event, data, name,
                      stream_state, request_id, base_payload) -> bool
Returns True if the stream should be aborted.
"""
from sparta_ai.streaming.handlers.chat_model_stream import handle_chat_model_stream
from sparta_ai.streaming.handlers.model_events import handle_model_start, handle_model_end
from sparta_ai.streaming.handlers.tool_handlers import handle_tool_start, handle_tool_end, handle_tool_error
from sparta_ai.streaming.handlers.chain_events import handle_chain_start, handle_chain_end
from sparta_ai.streaming.handlers.custom_events import handle_custom_event

# Dispatch table: maps LangGraph event kind to handler function.
# Adding a new event type = one new entry + one new handler module.
DISPATCH_TABLE: dict[str, callable] = {
    "on_chat_model_stream": handle_chat_model_stream,
    "on_chat_model_start": handle_model_start,
    "on_chat_model_end": handle_model_end,
    "on_tool_start": handle_tool_start,
    "on_tool_end": handle_tool_end,
    "on_tool_error": handle_tool_error,
    "on_chain_start": handle_chain_start,
    "on_chain_end": handle_chain_end,
    "on_custom_event": handle_custom_event,
}

__all__ = ["DISPATCH_TABLE"]
