"""Serializable work contracts; deliberately separate from inference callbacks."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WorkModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ModelSelection(WorkModel):
    providerId: str = Field(min_length=1, max_length=200)
    modelId: str = Field(min_length=1, max_length=300)
    temperature: float = Field(default=0.6, ge=0, le=2, allow_inf_nan=False)
    topP: float = Field(default=0.95, ge=0, le=1, allow_inf_nan=False)
    maxTokens: int = Field(default=8192, ge=1, le=1_000_000)


class WorkRequest(WorkModel):
    version: Literal[1] = 1
    prompt: str = Field(min_length=1, max_length=32_000)
    # First API slice deliberately supports independent requests only. Thread/project
    # binding requires an atomic ownership check before the chat adapter is enabled.
    origin: Literal["manual"] = "manual"
    temporary: Literal[False] = False
    selection: ModelSelection
    permissionMode: Literal["ask", "auto", "full"] = "ask"


class CreateWorkRequest(WorkModel):
    requestKey: str = Field(min_length=1, max_length=200, pattern=r"\S")
    request: WorkRequest


class WorkAction(WorkModel):
    expectedRevision: int = Field(ge=1)
    action: Literal["pause", "resume", "cancel"]
