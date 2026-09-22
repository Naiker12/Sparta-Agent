from __future__ import annotations
from typing import Any, Optional, List

BATCH_MIN = 1
BATCH_MAX = 32768
PARALLEL_MIN = 1
PARALLEL_MAX = 64


def _effective_tensor_parallel(*args, **kwargs):
    return False


def drop_managed_flags(flags: List[str] | None, *args, **kwargs) -> List[str]:
    return flags or []


def extra_args_disable_mmproj(*args, **kwargs):
    return []


def parse_gpu_layers_override(*args, **kwargs):
    return None


def parse_split_mode_override(*args, **kwargs):
    return None


def resolve_tensor_parallel(*args, **kwargs):
    return False


def strip_shadowing_flags(flags: List[str] | None, *args, **kwargs) -> List[str]:
    return flags or []


def strip_split_mode_only(flags: List[str] | None = None, *args, **kwargs) -> List[str]:
    return flags or []


def validate_extra_args(*args, **kwargs):
    return []
