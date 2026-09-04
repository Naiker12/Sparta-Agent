"""Pydantic schemas for RAG knowledge bases, search and linked folders."""

from typing import List, Optional
from pydantic import BaseModel, Field

import core.rag.config as config


class CreateKbRequest(BaseModel):
    name: str = Field(min_length = 1, max_length = 200)
    description: str | None = None


class UpdateKbRequest(BaseModel):
    name: str | None = Field(default = None, max_length = 200)
    description: str | None = None


class SearchRequest(BaseModel):
    query: str
    kb_id: str | None = None
    thread_id: str | None = None
    project_id: str | None = None
    top_k: int = Field(default = config.TOP_K_HYBRID, ge = 1, le = 50)
    min_score: float = 0.0
    mode: str = "hybrid"  # hybrid | lexical | dense


class LinkFolderRequest(BaseModel):
    name: str | None = Field(default = None, alias = "displayName", max_length = 200)
    auto_sync: bool = Field(default = True, alias = "autoSync")
    native_path_lease: str = Field(alias = "nativePathLease", min_length = 1)


class UpdateFolderRequest(BaseModel):
    name: str | None = Field(default = None, max_length = 200)
    auto_sync: bool | None = Field(default = None, alias = "autoSync")
