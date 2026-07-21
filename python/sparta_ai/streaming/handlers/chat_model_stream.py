"""Handler for on_chat_model_stream events — reasoning + text tokens."""
import logging
from typing import Any, Callable

from sparta_ai.streaming.emitters import reasoning_events
from sparta_ai.streaming.event_dispatcher import (
    _block_text,
    _extract_reasoning_content,
    _is_reasoning_block,
    _is_text_block,
)
from sparta_ai.streaming.skill_detector import build_skill_payload, detect_skill
from sparta_ai.streaming.think_scrubber import StreamingThinkScrubber
from sparta_ai.streaming.repetition_guard import RepetitionGuard

logger = logging.getLogger("sparta_ai.streaming")


def _detect_and_emit_skill(
    emit_control_fn: Callable[[str, dict], Any],
    thinking_text: str,
    stream_state: dict,
    base_payload: dict,
) -> None:
    detected = detect_skill(thinking_text, stream_state.get("active_skill_ids", []), stream_state)
    if detected:
        logger.info("Skill activated: %s", detected.get("name", detected["id"]))
        emit_control_fn("skill:activated", build_skill_payload(detected, base_payload))


def _extract_tool_output_str(data: dict) -> str:
    raw_output = data.get("output", "")
    if hasattr(raw_output, "content"):
        return str(raw_output.content) if raw_output.content is not None else ""
    return str(raw_output)


async def handle_chat_model_stream(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    chunk = data.get("chunk")
    if chunk is None:
        return False

    reasoning_content = _extract_reasoning_content(chunk)
    reasoning_from_metadata = bool(reasoning_content)

    if reasoning_content:
        if not stream_state["thinking_active"]:
            logger.debug("Emitting thinking:started for request %s", request_id)
            emit_control_fn(*reasoning_events.thinking_started(base_payload))
            stream_state["thinking_active"] = True
        stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
        stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning_content)
        logger.debug("Emitting thinking:token (reasoning_content) for request %s", request_id)
        emit_fn(*reasoning_events.thinking_token(base_payload, reasoning_content))

        _detect_and_emit_skill(emit_control_fn, reasoning_content, stream_state, base_payload)

        content = getattr(chunk, "content", "")
        if isinstance(content, str) and content:
            scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
            scrubber.feed(content)

        return False

    content = getattr(chunk, "content", "")
    if isinstance(content, list):
        for block in content:
            if _is_reasoning_block(block):
                if reasoning_from_metadata:
                    continue
                if not stream_state["thinking_active"]:
                    logger.debug("Emitting thinking:started for request %s", request_id)
                    emit_control_fn(*reasoning_events.thinking_started(base_payload))
                    stream_state["thinking_active"] = True
                token = _block_text(block)
                if token:
                    stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(token.split())
                    stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(token)
                    logger.debug("Emitting thinking:token (reasoning block) for request %s", request_id)
                    emit_fn(*reasoning_events.thinking_token(base_payload, token))
                    _detect_and_emit_skill(emit_control_fn, token, stream_state, base_payload)
            elif _is_text_block(block):
                text = _block_text(block)
                if text:
                    rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                    if rep_guard.feed(text):
                        logger.warning("Repetition detected in text block, aborting")
                        emit_control_fn("stream:degenerate", {**base_payload})
                        return True
                    # BUGFIX: en este camino (content como lista de bloques,
                    # p.ej. bloques "thinking" alternados con bloques "text")
                    # nunca se cerraba el thinking al llegar el primer bloque
                    # de texto visible. Por eso el panel se quedaba en
                    # "Pensando..." corriendo durante TODA la respuesta y
                    # solo cerraba al final por el safety-net de
                    # stream:completed, en vez de cerrar justo cuando
                    # arranca la respuesta real (como sí pasaba ya en el
                    # camino de contenido como string plano, más abajo).
                    if stream_state["thinking_active"]:
                        emit_control_fn(*reasoning_events.thinking_completed(base_payload, stream_state.get("reasoning_tokens", 0)))
                        stream_state["thinking_active"] = False
                    stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(text)
                    emit_fn("stream:token", {**base_payload, "token": text})
            elif isinstance(block, dict) and block.get("type") == "tool_use":
                continue
    elif isinstance(content, str) and content:
        scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
        visible, reasoning = scrubber.feed(content)

        emitted = stream_state.get("_emitted_text", "")
        if visible and emitted:
            pending = stream_state.get("_skip_pending", "")
            if stream_state.get("_skip_mode"):
                pending += visible
                if emitted.startswith(pending):
                    stream_state["_skip_pending"] = pending
                    return False
                else:
                    overlap_start = len(emitted[:len(pending)])
                    new_text = pending[overlap_start:]
                    stream_state["_skip_mode"] = False
                    stream_state["_skip_pending"] = ""
                    if new_text:
                        rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                        if rep_guard.feed(new_text):
                            return True
                        stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(new_text)
                        stream_state["_emitted_text"] = emitted + new_text
                        emit_fn("stream:token", {**base_payload, "token": new_text})
                    return False
            else:
                test_text = (pending + visible)[:80]
                if len(test_text) >= 10 and emitted.startswith(test_text) and len(emitted) > len(test_text) * 2:
                    stream_state["_skip_mode"] = True
                    stream_state["_skip_pending"] = test_text
                    return False
        elif visible:
            stream_state["_emitted_text"] = emitted + visible

        if reasoning and not reasoning_from_metadata:
            if not stream_state["thinking_active"]:
                logger.debug("Emitting thinking:started for request %s", request_id)
                emit_control_fn(*reasoning_events.thinking_started(base_payload, origin="emulated"))
                stream_state["thinking_active"] = True
            stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
            stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning)
            logger.debug("Emitting thinking:token (inline think tag) for request %s", request_id)
            emit_fn(*reasoning_events.thinking_token(base_payload, reasoning, origin="emulated"))
            _detect_and_emit_skill(emit_control_fn, reasoning, stream_state, base_payload)

        if visible:
            rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
            if rep_guard.feed(visible):
                logger.warning("Repetition detected in visible text, aborting")
                emit_control_fn("stream:degenerate", {**base_payload})
                return True
            if stream_state["thinking_active"] and not reasoning:
                emit_control_fn(*reasoning_events.thinking_completed(base_payload, stream_state.get("reasoning_tokens", 0)))
                stream_state["thinking_active"] = False
            stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
            stream_state["_emitted_text"] = stream_state.get("_emitted_text", "") + visible
            emit_fn("stream:token", {**base_payload, "token": visible})

    return False
