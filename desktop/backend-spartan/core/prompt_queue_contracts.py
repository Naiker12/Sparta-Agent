"""Versioned data-only checkpoints for the existing chat queue."""
from typing import Literal
import math

from pydantic import Field, JsonValue, field_validator, model_validator

from core.work_requests import WorkModel

SETTING_KEYS = frozenset("""supportsTools supportsReasoning reasoningAlwaysOn reasoningStyle
supportsReasoningOff reasoningEffortLevels supportsPreserveThinking reasoningEnabled reasoningEffort
preserveThinking toolsEnabled codeToolsEnabled imageToolsEnabled artifactsEnabled mcpEnabledForChat
confirmToolCalls bypassPermissions permissionMode webFetchToolsEnabled deepResearchEnabled
researchWebsitePolicy researchModelTimeoutSeconds ragEnabled ragSource ragMode ragTopK ragAutoInject
ragAutoInjectMinScore ggufContextLength autoHealToolCalls nudgeToolCalls maxToolCallsPerMessage
toolCallTimeout params""".split())
PARAM_KEYS = frozenset("""temperature topP topK minP repetitionPenalty presencePenalty maxSeqLength
maxTokens systemPrompt systemVariables checkpoint trustRemoteCode fastMode""".split())
BOOLEAN_KEYS = frozenset("""supportsTools supportsReasoning reasoningAlwaysOn supportsReasoningOff
supportsPreserveThinking reasoningEnabled preserveThinking toolsEnabled codeToolsEnabled imageToolsEnabled
artifactsEnabled mcpEnabledForChat confirmToolCalls bypassPermissions webFetchToolsEnabled deepResearchEnabled
ragEnabled autoHealToolCalls nudgeToolCalls""".split())
NUMBER_KEYS = frozenset("""researchModelTimeoutSeconds ragTopK ragAutoInjectMinScore ggufContextLength
maxToolCallsPerMessage toolCallTimeout""".split())
ENUM_VALUES = {
    "permissionMode": {"ask", "auto", "off"},
    "reasoningEffort": {"none", "minimal", "low", "medium", "high", "max", "xhigh"},
    "reasoningStyle": {"enable_thinking", "reasoning_effort", "enable_thinking_effort"},
    "ragMode": {"hybrid", "lexical", "dense"},
    "ragAutoInject": {"auto", "on", "off"},
}


class QueueExecutionResult(WorkModel):
    status: Literal["completed", "failed", "cancelled", "needs_review"]
    messageId: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str = Field(default="", max_length=2000)
    reason: Literal["completed", "cancelled", "error", "incomplete", "unknown"] = "unknown"


class QueueItemCheckpoint(WorkModel):
    id: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1, max_length=200_000)
    dispatched: bool
    settings: dict[str, JsonValue]
    result: QueueExecutionResult | None = None

    @model_validator(mode="after")
    def result_requires_dispatch(self):
        if self.result and not self.dispatched:
            raise ValueError("A pending item cannot report an execution result")
        return self

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, value):
        if set(value) - SETTING_KEYS:
            raise ValueError("Unsupported queue settings")
        params = value.get("params")
        if not isinstance(params, dict) or set(params) - PARAM_KEYS:
            raise ValueError("Unsupported queue model parameters")
        if not isinstance(params.get("checkpoint"), str) or not params["checkpoint"]:
            raise ValueError("A queued model is required")
        for key, item in params.items():
            if key in {"checkpoint", "systemPrompt", "systemVariables"}:
                valid = isinstance(item, str)
            elif key in {"trustRemoteCode", "fastMode"}:
                valid = isinstance(item, bool)
            else:
                valid = type(item) in {int, float} and math.isfinite(item)
            if not valid:
                raise ValueError("Invalid queue model parameter")
        permission = value.get("permissionMode")
        if not isinstance(permission, str) or permission not in ENUM_VALUES["permissionMode"]:
            raise ValueError("Session-only access cannot be persisted")
        if value.get("bypassPermissions") is not False:
            raise ValueError("Session-only bypass cannot be persisted")
        for key, item in value.items():
            if key in BOOLEAN_KEYS and not isinstance(item, bool):
                raise ValueError("Invalid boolean queue setting")
            if key in NUMBER_KEYS and not (key == "ggufContextLength" and item is None):
                if type(item) not in {int, float} or not math.isfinite(item):
                    raise ValueError("Invalid numeric queue setting")
            if key in ENUM_VALUES and not (key == "reasoningStyle" and item is None):
                if not isinstance(item, str) or item not in ENUM_VALUES[key]:
                    raise ValueError("Invalid enum queue setting")
        # Nested containers are limited to the two structured settings below.
        for key, item in value.items():
            if key not in {"params", "ragSource", "researchWebsitePolicy", "reasoningEffortLevels"}:
                if isinstance(item, (dict, list)):
                    raise ValueError("Unexpected nested queue setting")
        source = value.get("ragSource")
        if source is not None and (not isinstance(source, dict) or set(source) - {"type", "kbId"}):
            raise ValueError("Unsupported document scope")
        if source is not None:
            if source.get("type") == "thread":
                if set(source) != {"type"}:
                    raise ValueError("Invalid thread document scope")
            elif source.get("type") != "kb" or not isinstance(source.get("kbId"), str):
                raise ValueError("Invalid knowledge base scope")
        policy = value.get("researchWebsitePolicy")
        if policy is not None and (not isinstance(policy, dict) or set(policy) - {"allowedDomains", "blockedDomains"}):
            raise ValueError("Unsupported website policy")
        if policy and any(not isinstance(domains, list) or any(not isinstance(domain, str) for domain in domains)
                          for domains in policy.values()):
            raise ValueError("Invalid website domains")
        for key, item in value.items():
            if isinstance(item, float) and not math.isfinite(item):
                raise ValueError("Nonfinite queue setting")
        levels = value.get("reasoningEffortLevels")
        if levels is not None and (not isinstance(levels, list) or
                any(not isinstance(level, str) or level not in ENUM_VALUES["reasoningEffort"] for level in levels)):
            raise ValueError("Invalid reasoning levels")
        return value


class QueueCheckpoint(WorkModel):
    version: Literal[1] = 1
    threadId: str = Field(min_length=1, max_length=200)
    projectId: str | None = Field(default=None, max_length=200)
    items: list[QueueItemCheckpoint] = Field(max_length=100)

    @field_validator("items")
    @classmethod
    def unique_items(cls, value):
        if len({item.id for item in value}) != len(value):
            raise ValueError("Duplicate queue item ids")
        return value


class SaveQueueCheckpoint(WorkModel):
    expectedRevision: int = Field(ge=0)
    checkpoint: QueueCheckpoint
