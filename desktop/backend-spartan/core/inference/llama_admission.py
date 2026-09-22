from __future__ import annotations
from typing import Any, Optional


class LlamaAdmissionCancelled(Exception):
    pass


class LlamaAdmissionTimeout(Exception):
    pass


class LlamaAdmissionQueueFull(Exception):
    pass


class LlamaAdmissionConfig:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class LlamaAdmissionLease:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    def release(self):
        pass


class LlamaAdmissionReservation:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class _AdmissionQueue:
    def reserve(self, *args, **kwargs):
        return LlamaAdmissionReservation()

    def snapshot(self):
        return {}


_queue = _AdmissionQueue()


def get_llama_admission_queue():
    return _queue


def llama_admission_config_from_env():
    return LlamaAdmissionConfig()


def peek_llama_admission_snapshot():
    return {}
