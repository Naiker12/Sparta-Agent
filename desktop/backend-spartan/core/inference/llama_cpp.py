from __future__ import annotations
from typing import Any, Optional

_DEFAULT_FIRST_TOKEN_TIMEOUT_S = 60.0
_DEFAULT_MAX_TOKENS_FLOOR = 16
_DEFAULT_STREAM_STALL_TIMEOUT_S = 30.0
LLAMA_SERVER_NOT_FOUND_DETAIL = "llama-server not found or disabled"


class GgufLoadIntent:
    def __init__(self, *args, **kwargs):
        pass


class LlamaCppBackend:
    is_active = False

    def __init__(self, *args, **kwargs):
        self.is_active = False

    @staticmethod
    def _find_llama_server_binary(*args, **kwargs):
        return None

    @staticmethod
    def _is_unsloth_managed_binary(*args, **kwargs):
        return False

    @staticmethod
    def _missing_library_message(*args, **kwargs):
        return "llama.cpp disabled"

    def _binary_changed_since_launch(self):
        return False


def _emitted_n_batch(*args, **kwargs):
    return None


def _extra_args_draft_device_pin(*args, **kwargs):
    return []


def _extra_args_n_ubatch(*args, **kwargs):
    return []


def _hf_offline_if_unreachable(*args, **kwargs):
    return False


def _hf_offline_if_unreachable_for(*args, **kwargs):
    return False


def _kv_bytes_per_elem(*args, **kwargs):
    return 2


def _kv_unified_from_args(*args, **kwargs):
    return False


def _metal_device_is_paravirtual(*args, **kwargs):
    return False


def _planned_main_cache_types(*args, **kwargs):
    return ("f16", "f16")


def _swa_full_from_args_or_env(*args, **kwargs):
    return False


def detect_reasoning_flags(*args, **kwargs):
    return []


def paravirtual_normalized_request(req, *args, **kwargs):
    return req
