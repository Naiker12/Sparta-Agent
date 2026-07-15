"""Message cleanup utilities for cross-provider safety and thinking-only turn filtering.

Mirrors Hermes Agent's:
  - drop_thinking_only_and_merge_users()
  - copy_reasoning_content_for_api()
  - reapply_reasoning_echo_for_provider()

These functions operate on COPIES of messages (the ones sent to the API),
never mutating the stored conversation history.
"""

import copy
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.agents.message_cleanup")

# Vendors that REQUIRE reasoning_content in the API request
_REQUIRE_REASONING_CONTENT = {"deepseek", "kimi"}

# Vendors that REJECT reasoning_content (will return HTTP 422)
_REJECT_REASONING_CONTENT = {"mistral", "groq", "cerebras"}

# Vendors that expect reasoning as native content blocks instead of a separate field
_BLOCK_REASONING_VENDORS = {"anthropic"}


def drop_thinking_only_and_merge_users(messages: list[dict]) -> list[dict]:
    """Filter out assistant-only-thinking turns from a COPY of messages.

    When the model generates an assistant turn that only contains reasoning
    (no visible content, no tool_calls), that turn is useless to the provider
    but breaks the role alternation invariant.

    This function:
    1. Drops assistant-only-thinking turns
    2. If two user messages become adjacent after dropping, merges them
    3. Operates on a COPY — never mutates the original history

    Args:
        messages: The original message list (unmodified).

    Returns:
        A new filtered list suitable for the API call.
    """
    result = copy.deepcopy(messages)
    changed = True

    while changed:
        changed = False
        new_result = []

        for i, msg in enumerate(result):
            role = msg.get("role", "")
            if role == "assistant" and _is_thinking_only(msg):
                logger.debug(
                    "Dropping thinking-only assistant turn at index %d: reasoning=%s, content=%s, has_tool_calls=%s",
                    i,
                    bool(msg.get("reasoning") or msg.get("reasoning_content")),
                    bool(msg.get("content")),
                    bool(msg.get("tool_calls")),
                )
                changed = True
                continue
            new_result.append(msg)

        result = new_result

        # Merge adjacent user messages
        i = 0
        while i < len(result) - 1:
            if result[i].get("role") == "user" and result[i + 1].get("role") == "user":
                merged = {
                    "role": "user",
                    "content": (result[i].get("content", "") or "")
                    + "\n\n"
                    + (result[i + 1].get("content", "") or ""),
                }
                result = result[:i] + [merged] + result[i + 2:]
                changed = True
            else:
                i += 1

    return result


def _is_thinking_only(msg: dict) -> bool:
    """Check if an assistant message is 'thinking-only' (no visible content or tool calls).

    A message is thinking-only if:
    - It has reasoning content (reasoning or reasoning_content)
    - It has NO visible text content
    - It has NO tool_calls
    """
    if msg.get("role") != "assistant":
        return False
    has_content = bool(msg.get("content"))
    has_tool_calls = bool(msg.get("tool_calls"))
    has_reasoning = bool(msg.get("reasoning") or msg.get("reasoning_content"))
    return has_reasoning and not has_content and not has_tool_calls


def copy_reasoning_content_for_api(
    messages: list[dict],
    vendor: str,
) -> list[dict]:
    """Prepare reasoning fields in messages for the target provider.

    Different providers handle reasoning_content differently:
    - DeepSeek/Kimi: REQUIRE it (HTTP 400 if missing)
    - Mistral/Groq/Cerebras: REJECT it (HTTP 422 if present)
    - Others: May accept but ignore it

    This function:
    1. If the current provider REQUIRES reasoning_content:
       - Ensures it's present (promotes reasoning, injects " " if needed)
    2. If the current provider REJECTS reasoning_content:
       - Removes the field entirely
    3. If tool_calls are present and provider needs reasoning:
       - Injects " " as placeholder (DeepSeek V4 Pro requirement)

    Args:
        messages: The message list to process (will be copied).
        vendor: The target provider vendor string.

    Returns:
        A new list with sanitized reasoning fields.
    """
    result = copy.deepcopy(messages)
    vendor_lower = vendor.lower()
    requires = vendor_lower in _REQUIRE_REASONING_CONTENT
    rejects = vendor_lower in _REJECT_REASONING_CONTENT

    for msg in result:
        if msg.get("role") != "assistant":
            continue

        if requires:
            _ensure_reasoning_content(msg)
        elif rejects:
            _remove_reasoning_fields(msg)
        else:
            # Neutral: promote reasoning to reasoning_content if present
            _promote_reasoning_if_present(msg)

    return result


def _ensure_reasoning_content(msg: dict) -> None:
    """Ensure the message has reasoning_content for providers that require it."""
    existing = msg.get("reasoning_content")
    if existing is not None:
        if isinstance(existing, str) and existing.strip() == "":
            msg["reasoning_content"] = " "
        return

    # Promote reasoning to reasoning_content
    reasoning = msg.get("reasoning")
    if reasoning:
        msg["reasoning_content"] = reasoning
        return

    # If tool_calls present, inject " " as placeholder
    if msg.get("tool_calls"):
        msg["reasoning_content"] = " "
        return

    # Last resort: inject " " for DeepSeek/Kimi
    msg["reasoning_content"] = " "


def _remove_reasoning_fields(msg: dict) -> None:
    """Remove all reasoning fields for providers that reject them."""
    for key in ("reasoning", "reasoning_content", "reasoning_details"):
        msg.pop(key, None)


def _promote_reasoning_if_present(msg: dict) -> None:
    """For neutral providers, promote reasoning to reasoning_content if present."""
    if "reasoning_content" not in msg or msg.get("reasoning_content") is None:
        reasoning = msg.get("reasoning")
        if reasoning:
            msg["reasoning_content"] = reasoning


def reapply_reasoning_echo_for_provider(
    messages: list[dict],
    active_vendor: str,
    previous_vendor: str | None = None,
) -> list[dict]:
    """Reconcile reasoning fields when the provider changes mid-conversation.

    Called just before constructing the API request, this handles fallbacks:
    - DeepSeek → Mistral: removes reasoning_content (Mistral rejects it)
    - Mistral → DeepSeek: ensures reasoning_content is present

    Args:
        messages: The message list (will be copied).
        active_vendor: The current provider vendor.
        previous_vendor: The previous provider vendor, if a fallback occurred.

    Returns:
        A new list with reconciled reasoning fields.
    """
    result = copy.deepcopy(messages)
    vendor_lower = active_vendor.lower()
    was_different = previous_vendor is not None and previous_vendor.lower() != vendor_lower

    if not was_different:
        # Fast path: no fallback, just do standard copy
        return copy_reasoning_content_for_api(result, active_vendor)

    # Provider changed mid-conversation — clean ALL messages
    logger.info(
        "Provider changed from %s to %s — reapplying reasoning echo",
        previous_vendor,
        active_vendor,
    )

    for msg in result:
        if msg.get("role") != "assistant":
            continue

        if vendor_lower in _REJECT_REASONING_CONTENT:
            _remove_reasoning_fields(msg)
        elif vendor_lower in _REQUIRE_REASONING_CONTENT:
            _ensure_reasoning_content(msg)
        else:
            _promote_reasoning_if_present(msg)
            if vendor_lower not in _REQUIRE_REASONING_CONTENT:
                pass

    return result


def format_reasoning_for_provider(
    messages: list[dict],
    vendor: str,
) -> list[dict]:
    """Convert reasoning fields to the native format expected by the target provider.

    LangChain's `_format_messages` for Anthropic ignores the `reasoning_content`
    field on assistant messages, so historical reasoning would be silently lost
    when resuming a conversation with Claude. This function converts it to the
    Anthropic-native list of content blocks (`thinking` + `text`) so the model
    receives the full conversation context.

    For providers that require `reasoning_content` (DeepSeek/Kimi) the field is
    preserved. For providers that reject it, it is removed.

    Args:
        messages: The message list to process (will be copied).
        vendor: The target provider vendor string.

    Returns:
        A new list with reasoning formatted for the active provider.
    """
    result = copy.deepcopy(messages)
    vendor_lower = vendor.lower()

    for msg in result:
        if msg.get("role") != "assistant":
            continue

        reasoning = msg.get("reasoning_content") or msg.get("reasoning")
        if not reasoning:
            continue

        if vendor_lower in _REJECT_REASONING_CONTENT:
            _remove_reasoning_fields(msg)
            continue

        if vendor_lower in _BLOCK_REASONING_VENDORS:
            content = msg.get("content", "") or ""
            blocks: list[dict] = []
            if reasoning and str(reasoning).strip():
                blocks.append({"type": "thinking", "thinking": str(reasoning)})
            if content:
                blocks.append({"type": "text", "text": str(content)})
            msg["content"] = blocks if blocks else ""
            _remove_reasoning_fields(msg)
            continue

        # DeepSeek/Kimi and other neutral providers: keep reasoning_content if present
        if vendor_lower in _REQUIRE_REASONING_CONTENT:
            _ensure_reasoning_content(msg)
        else:
            _promote_reasoning_if_present(msg)

    return result


# ═════════════════════════════════════════════════════════════════════════
#  Single-pass cleanup (Algoritmo C — replaces 3x deepcopy with 1 pass)
# ═════════════════════════════════════════════════════════════════════════


def single_pass_cleanup(messages: list[dict], vendor: str) -> list[dict]:
    """Combined message cleanup in a single pass — no triple deepcopy.

    Performs in one iteration what previously required three separate
    ``copy.deepcopy()`` calls:
      1. Drop thinking-only assistant turns + merge adjacent users
      2. Copy/format reasoning_content for the target provider
      3. Convert reasoning blocks to provider-native format

    Each message is shallow-copied once (``dict(msg)``) instead of being
    deep-copied three times.  Nested structures (tool_calls, content
    blocks) are only copied when they actually need mutation.

    Args:
        messages: The original conversation messages (never mutated).
        vendor: The target provider vendor string (e.g. "lmstudio").

    Returns:
        A new list suitable for the API call.
    """
    vendor_lower = vendor.lower() if vendor else ""
    requires = vendor_lower in _REQUIRE_REASONING_CONTENT
    rejects = vendor_lower in _REJECT_REASONING_CONTENT
    is_anthropic = vendor_lower in _BLOCK_REASONING_VENDORS

    # Pass 1: filter thinking-only turns and build cleaned list
    result: list[dict] = []
    for msg in messages:
        # Shallow copy — only deep-copy if we need to mutate nested fields
        if isinstance(msg, dict):
            m = dict(msg)
        else:
            m = msg

        role = m.get("role", "")

        # Drop thinking-only assistant turns
        if role == "assistant" and _is_thinking_only(m):
            logger.debug("single_pass_cleanup: dropping thinking-only turn")
            continue

        # ── Reasoning field normalization (passes 2 & 3 combined) ──────
        if role == "assistant":
            if requires:
                _ensure_reasoning_content(m)
            elif rejects:
                _remove_reasoning_fields(m)
            elif is_anthropic:
                # Convert reasoning to Anthropic-native content blocks
                reasoning = m.get("reasoning_content") or m.get("reasoning")
                if reasoning:
                    content = m.get("content", "") or ""
                    blocks: list[dict] = []
                    if str(reasoning).strip():
                        blocks.append({"type": "thinking", "thinking": str(reasoning)})
                    if content:
                        blocks.append({"type": "text", "text": str(content)})
                    # Only deep-copy content if we're replacing it
                    if isinstance(m.get("content"), (list, dict)):
                        m = dict(m)  # re-copy since we may have shallow-copied already
                    m["content"] = blocks if blocks else ""
                    _remove_reasoning_fields(m)
            else:
                _promote_reasoning_if_present(m)

        result.append(m)

    # Pass 2: merge adjacent user messages
    merged: list[dict] = []
    i = 0
    while i < len(result):
        current = result[i]
        if current.get("role") == "user":
            # Look ahead for consecutive user messages
            combined_content = current.get("content", "") or ""
            j = i + 1
            while j < len(result) and result[j].get("role") == "user":
                next_content = result[j].get("content", "") or ""
                combined_content = combined_content + "\n\n" + next_content
                j += 1
            merged.append({"role": "user", "content": combined_content})
            i = j
        else:
            merged.append(current)
            i += 1

    logger.debug(
        "single_pass_cleanup: %d messages -> %d (vendor=%s)",
        len(messages), len(merged), vendor,
    )
    return merged
