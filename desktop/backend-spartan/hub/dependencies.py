
"""Shared FastAPI dependencies for Hub routes."""

from __future__ import annotations

from typing import Optional

from fastapi import Header

HUB_HF_TOKEN_HEADER = "X-Unsloth-HF-Token"
HUB_HF_TOKEN_MAX_LENGTH = 512


def get_hf_token(
    hf_token: Optional[str] = Header(
        None,
        alias = HUB_HF_TOKEN_HEADER,
        max_length = HUB_HF_TOKEN_MAX_LENGTH,
    ),
) -> Optional[str]:
    token = (hf_token or "").strip()
    return token or None
