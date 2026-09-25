"""Shared runtime state for API-backed chat requests.

This module deliberately contains no model loader, GPU, GGUF, or Hugging Face
dependency.  Both the OpenAI-compatible API route and remote-provider proxy use
it to honour cancellation requests consistently.
"""

from __future__ import annotations

import threading
import time

from state import active_generations


CANCEL_REGISTRY: dict[str, set[threading.Event]] = {}
CANCEL_LOCK = threading.Lock()
PENDING_CANCELS: dict[str, float] = {}
PENDING_CANCEL_TTL_S = 30.0


def prune_pending(now: float) -> None:
    for key in [key for key, stamp in PENDING_CANCELS.items() if now - stamp > PENDING_CANCEL_TTL_S]:
        PENDING_CANCELS.pop(key, None)


class TrackedCancel:
    """Register a request cancellation event while also tracking API work."""

    def __init__(self, event: threading.Event, *keys, thread_id=None, model=None, kind="chat"):
        self.event = event
        self.keys = tuple(key for key in keys if key)
        self._active = active_generations.ActiveGeneration(
            event, thread_id=thread_id, model=model, kind=kind
        )

    @classmethod
    def for_payload(cls, event: threading.Event, payload, *keys):
        return cls(
            event,
            *keys,
            thread_id=getattr(payload, "thread_id", None),
            model=getattr(payload, "model", None),
        )

    def __enter__(self):
        should_cancel = False
        with CANCEL_LOCK:
            for key in self.keys:
                CANCEL_REGISTRY.setdefault(key, set()).add(self.event)
            prune_pending(time.monotonic())
            for key in self.keys:
                if PENDING_CANCELS.pop(key, None) is not None:
                    should_cancel = True
        self._active.__enter__()
        if should_cancel:
            self.event.set()
        return self.event

    def __exit__(self, *exc):
        with CANCEL_LOCK:
            for key in self.keys:
                bucket = CANCEL_REGISTRY.get(key)
                if bucket is None:
                    continue
                bucket.discard(self.event)
                if not bucket:
                    CANCEL_REGISTRY.pop(key, None)
        self._active.__exit__(*exc)
        return False


def cancel_by_keys(keys) -> int:
    """Cancel all registered events for shared (non-stashed) identifiers."""
    if not keys:
        return 0
    events: set[threading.Event] = set()
    with CANCEL_LOCK:
        prune_pending(time.monotonic())
        for key in keys:
            events.update(CANCEL_REGISTRY.get(key, set()))
    for event in events:
        event.set()
    return len(events)


def cancel_by_cancel_id_or_stash(cancel_id: str) -> int:
    """Cancel a request by unique ID, retaining an early cancellation briefly."""
    now = time.monotonic()
    events: set[threading.Event] = set()
    with CANCEL_LOCK:
        prune_pending(now)
        bucket = CANCEL_REGISTRY.get(cancel_id)
        if bucket:
            events.update(bucket)
        else:
            PENDING_CANCELS[cancel_id] = now
    for event in events:
        event.set()
    return len(events)
