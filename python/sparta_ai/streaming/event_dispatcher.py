"""Shared event dispatch logic for both Electron and WebSocket streaming.

The EventDispatcher class receives LangGraph astream_events events and calls a
provided emit function. It does not know whether the output goes to stdout or a
WebSocket connection.
"""
import logging
from typing import Any, Callable

from sparta_ai.streaming.skill_detector import build_skill_payload, detect_skill
from sparta_ai.streaming.think_scrubber import StreamingThinkScrubber
from sparta_ai.streaming.repetition_guard import RepetitionGuard

logger = logging.getLogger("sparta_ai.streaming.dispatcher")


def _extract_namespace(event: dict) -> str:
    """Return the LangGraph namespace (e.g. ['agent', 'subagent_coordinator', 'agent'])."""
    metadata = event.get("metadata", {})
    ns = metadata.get("langgraph_node") or metadata.get("checkpoint_ns") or ""
    if isinstance(ns, list):
        return "/".join(str(p) for p in ns)
    return str(ns)


def _is_reasoning_block(block: Any) -> bool:
    """Detect typed content blocks that represent model reasoning/thinking."""
    if not isinstance(block, dict):
        return False
    block_type = block.get("type", "")
    return block_type in ("thinking", "reasoning")


def _is_text_block(block: Any) -> bool:
    if not isinstance(block, dict):
        return False
    return block.get("type", "") == "text"


def _block_text(block: dict) -> str:
    """Return the textual content of a typed block."""
    for key in ("thinking", "reasoning", "text", "content"):
        val = block.get(key)
        if isinstance(val, str):
            return val
    return ""


def _extract_reasoning_content(chunk: Any) -> str:
    """Extract reasoning content from providers that put it outside content blocks
    (e.g. DeepSeek / OpenRouter / Qwen via OpenAI-compatible APIs)."""
    for attr in ("additional_kwargs", "response_metadata"):
        meta = getattr(chunk, attr, None)
        if isinstance(meta, dict):
            for key in ("reasoning_content", "reasoning"):
                val = meta.get(key)
                if isinstance(val, str) and val:
                    return val
    return ""


class EventDispatcher:
    def __init__(self, emit_fn: Callable[[str, dict | None], None]):
        self._emit = emit_fn
        self._repetition_guard = RepetitionGuard()
        self._stream_state: dict[str, Any] = {
            "thinking_active": False,
            "last_detected_skill": None,
            "visible_chars": 0,
            "reasoning_chars": 0,
            "_stream_seq": 0,
            "_think_seq": 0,
        }

    def get_state(self) -> dict[str, Any]:
        return self._stream_state

    def set_active_skills(self, skill_ids: list[str]) -> None:
        self._stream_state["active_skill_ids"] = skill_ids

    def _next_stream_seq(self) -> int:
        self._stream_state["_stream_seq"] += 1
        return self._stream_state["_stream_seq"]

    def _next_think_seq(self) -> int:
        self._stream_state["_think_seq"] += 1
        return self._stream_state["_think_seq"]

    async def dispatch(self, event: dict) -> None:
        kind = event.get("event", "")
        data: dict = event.get("data", {})
        name: str = event.get("name", "")
        namespace = _extract_namespace(event)
        base_payload = {"ns": namespace} if namespace else {}

        if kind == "on_chat_model_stream":
            await self._handle_chat_model_stream(data, base_payload)
        elif kind == "on_chat_model_start":
            self._handle_chat_model_start(data, base_payload)
        elif kind == "on_chat_model_end":
            await self._handle_chat_model_end(data, base_payload)
        elif kind == "on_tool_start":
            self._handle_tool_start(event, data, name, base_payload)
        elif kind == "on_tool_end":
            self._handle_tool_end(event, data, name, base_payload)
        elif kind == "on_tool_error":
            self._handle_tool_error(event, data, name, base_payload)
        elif kind == "on_custom_event":
            await self._handle_custom_event(data, base_payload)
        elif kind == "on_chain_end" and name == "agent":
            self._handle_chain_end_agent(base_payload)

    async def _handle_chat_model_stream(self, data: dict, base_payload: dict) -> None:
        chunk = data.get("chunk")
        if chunk is None:
            return

        reasoning_content = _extract_reasoning_content(chunk)
        reasoning_from_metadata = bool(reasoning_content)
        self._stream_state["_reasoning_extracted"] = bool(reasoning_content)
        if reasoning_content:
            if not self._stream_state["thinking_active"]:
                self._emit("thinking:started", base_payload)
                self._stream_state["thinking_active"] = True
            self._stream_state["reasoning_tokens"] = self._stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
            self._stream_state["reasoning_chars"] = self._stream_state.get("reasoning_chars", 0) + len(reasoning_content)
            self._emit("thinking:token", {**base_payload, "token": reasoning_content, "chunkSeq": self._next_think_seq()})
            await self._detect_and_emit_skill(reasoning_content, base_payload)
            # Avoid duplicated reasoning that often appears in the content string on the same chunk.
            return

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if reasoning_from_metadata:
                        continue
                    if not self._stream_state["thinking_active"]:
                        self._emit("thinking:started", base_payload)
                        self._stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        self._stream_state["reasoning_tokens"] = self._stream_state.get("reasoning_tokens", 0) + len(token.split())
                        self._stream_state["reasoning_chars"] = self._stream_state.get("reasoning_chars", 0) + len(token)
                        self._emit("thinking:token", {**base_payload, "token": token, "chunkSeq": self._next_think_seq()})
                        await self._detect_and_emit_skill(token, base_payload)
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        if self._repetition_guard.feed(text):
                            logger.warning("Repetition detected in text block, aborting stream")
                            self._emit("stream:degenerate", {**base_payload})
                            return
                        self._stream_state["visible_chars"] = self._stream_state.get("visible_chars", 0) + len(text)
                        self._emit("stream:token", {**base_payload, "token": text, "chunkSeq": self._next_stream_seq()})
                elif isinstance(block, dict) and block.get("type") == "tool_use":
                    # Anthropic tool_use blocks are part of the assistant message,
                    # not streamed tokens; ignore here.
                    continue
        elif isinstance(content, str) and content:
            # Skip inline scrubber if reasoning was already extracted from metadata
            if self._stream_state.get("_reasoning_extracted"):
                if content.strip():
                    if self._repetition_guard.feed(content):
                        logger.warning("Repetition detected in visible text, aborting stream")
                        self._emit("stream:degenerate", {**base_payload})
                        return
                    self._stream_state["visible_chars"] = self._stream_state.get("visible_chars", 0) + len(content)
                    self._emit("stream:token", {**base_payload, "token": content, "chunkSeq": self._next_stream_seq()})
                self._stream_state["_reasoning_extracted"] = False
                return

            scrubber = self._stream_state.setdefault("_scrubber", StreamingThinkScrubber())
            visible, reasoning = scrubber.feed(content)

            if reasoning and not reasoning_from_metadata:
                if not self._stream_state["thinking_active"]:
                    self._emit("thinking:started", base_payload)
                    self._stream_state["thinking_active"] = True
                self._stream_state["reasoning_tokens"] = self._stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
                self._stream_state["reasoning_chars"] = self._stream_state.get("reasoning_chars", 0) + len(reasoning)
                self._emit("thinking:token", {**base_payload, "token": reasoning, "chunkSeq": self._next_think_seq()})
                await self._detect_and_emit_skill(reasoning, base_payload)

            if visible:
                if self._repetition_guard.feed(visible):
                    logger.warning("Repetition detected in visible text, aborting stream")
                    self._emit("stream:degenerate", {**base_payload})
                    return
                if self._stream_state["thinking_active"] and not reasoning:
                    self._emit(
                        "thinking:completed",
                        {**base_payload, "tokens_used": self._stream_state.get("reasoning_tokens", 0)},
                    )
                    self._stream_state["thinking_active"] = False
                self._stream_state["visible_chars"] = self._stream_state.get("visible_chars", 0) + len(visible)
                self._emit("stream:token", {**base_payload, "token": visible, "chunkSeq": self._next_stream_seq()})

    def _handle_chat_model_start(self, data: dict, base_payload: dict) -> None:
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            if not self._stream_state["thinking_active"]:
                self._emit("thinking:started", base_payload)
                self._stream_state["thinking_active"] = True

    async def _handle_chat_model_end(self, data: dict, base_payload: dict) -> None:
        output = data.get("output", {})
        usage_metadata = getattr(output, "usage_metadata", None)
        input_tokens = 0
        output_tokens = 0
        if usage_metadata:
            input_tokens = getattr(usage_metadata, "input_tokens", 0)
            output_tokens = getattr(usage_metadata, "output_tokens", 0)
            self._emit(
                "usage",
                {
                    **base_payload,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                },
            )
        if self._stream_state["thinking_active"]:
            self._emit("thinking:completed", {**base_payload, "tokens_used": output_tokens})
            self._stream_state["thinking_active"] = False
        # Flush any partial tag retained by the scrubber.
        scrubber = self._stream_state.get("_scrubber")
        if scrubber:
            leftover = scrubber.flush()
            if leftover:
                self._stream_state["visible_chars"] = self._stream_state.get("visible_chars", 0) + len(leftover)
                self._emit("stream:token", {**base_payload, "token": leftover, "chunkSeq": self._next_stream_seq()})

    def _handle_tool_start(self, event: dict, data: dict, name: str, base_payload: dict) -> None:
        tool_call_id = event.get("run_id", str(id(event)))
        tool_input = data.get("input", {})
        self._emit(
            "tool:called",
            {
                **base_payload,
                "name": name,
                "input": tool_input,
                "tool_call_id": tool_call_id,
            },
        )
        # Emit terminal command immediately so it reaches the PTY without waiting for tool
        # completion.
        if name == "terminal_execute_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            self._emit("terminal:agent_command", {"command": cmd})

    def _handle_tool_end(self, event: dict, data: dict, name: str, base_payload: dict) -> None:
        tool_call_id = event.get("run_id", "unknown")
        self._emit(
            "tool:result",
            {
                **base_payload,
                "name": name,
                "output": str(data.get("output", "")),
                "duration_ms": data.get("run_time_ms", 0),
                "tool_call_id": tool_call_id,
            },
        )

    def _handle_tool_error(self, event: dict, data: dict, name: str, base_payload: dict) -> None:
        tool_call_id = event.get("run_id", "unknown")
        self._emit(
            "tool:error",
            {
                **base_payload,
                "name": name,
                "error": str(data.get("error", "Tool execution failed")),
                "tool_call_id": tool_call_id,
            },
        )

    async def _handle_custom_event(self, data: dict, base_payload: dict) -> None:
        event_name = data.get("name", "")
        event_data = data.get("data", {})
        if event_name == "tool_progress":
            self._emit("search:progress", {**base_payload, **event_data})

    def _handle_chain_end_agent(self, base_payload: dict) -> None:
        if self._stream_state.get("_stream_completed"):
            return
        if self._stream_state["thinking_active"]:
            self._emit("thinking:completed", {**base_payload, "tokens_used": 0})
            self._stream_state["thinking_active"] = False
        if self._stream_state.get("visible_chars", 0) == 0:
            self._emit(
                "error",
                {
                    "code": "empty_response",
                    "message": "El modelo no devolvió contenido visible.",
                },
            )
            self._stream_state["_stream_completed"] = True
            return
        self._repetition_guard.reset()
        self._emit("stream:completed", base_payload)
        self._stream_state["_stream_completed"] = True

    async def _detect_and_emit_skill(self, thinking_text: str, base_payload: dict) -> None:
        """Detect if the LLM is activating a skill and emit skill:activated."""
        detected = detect_skill(thinking_text, self._stream_state.get("active_skill_ids", []), self._stream_state)
        if detected:
            logger.info("Skill activated: %s", detected.get("name", detected["id"]))
            self._emit("skill:activated", build_skill_payload(detected, base_payload))
