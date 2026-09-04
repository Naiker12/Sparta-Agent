"""Pydantic request and response schemas for chat history endpoints."""

from typing import Annotated, Any, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.inference.llama_server_args import BATCH_MAX, BATCH_MIN, PARALLEL_MAX, PARALLEL_MIN

class ChatRagThreadSource(BaseModel):
    model_config = ConfigDict(extra = "forbid")

    type: Literal["thread"]


class ChatRagKnowledgeBaseSource(BaseModel):
    model_config = ConfigDict(extra = "forbid")

    type: Literal["kb"]
    kbId: str = Field(min_length = 1, max_length = 256)


class ChatThreadSettings(BaseModel):
    """The chat settings captured per thread; a thread storing none uses the global ones."""

    # allow_inf_nan as in ChatInferenceSettings: json.loads and pydantic both take
    # a bare NaN, which is then stored as a token no strict reader can parse back.
    model_config = ConfigDict(extra = "forbid", allow_inf_nan = False)

    reasoningEnabled: Optional[bool] = None
    reasoningEffort: Optional[
        Literal["none", "minimal", "low", "medium", "high", "max", "xhigh"]
    ] = None
    toolsEnabled: Optional[bool] = None
    codeToolsEnabled: Optional[bool] = None
    imageToolsEnabled: Optional[bool] = None
    webFetchToolsEnabled: Optional[bool] = None
    deepResearchEnabled: Optional[bool] = None
    artifactsEnabled: Optional[bool] = None
    mcpEnabledForChat: Optional[bool] = None
    # "full" (Full access) is session-only and never persisted, per thread or globally.
    permissionMode: Optional[Literal["ask", "auto", "off"]] = None
    ragEnabled: Optional[bool] = None
    ragSource: Optional[
        Annotated[
            Union[ChatRagThreadSource, ChatRagKnowledgeBaseSource],
            Field(discriminator = "type"),
        ]
    ] = None
    ragMode: Optional[Literal["hybrid", "lexical", "dense"]] = None
    # Matches the ge/le the retrieval endpoint enforces on its own top_k.
    ragTopK: Optional[int] = Field(default = None, ge = 1, le = 50)
    ragAutoInject: Optional[Literal["auto", "on", "off"]] = None
    ragAutoInjectMinScore: Optional[float] = Field(default = None, ge = 0, le = 1)
    # The sampling params a chat runs with. Ranges match the sliders that set them.
    temperature: Optional[float] = Field(default = None, ge = 0, le = 2)
    topP: Optional[float] = Field(default = None, ge = 0, le = 1)
    # -1 disables top-k, matching ChatCompletionRequest and the default.yaml fallback.
    topK: Optional[int] = Field(default = None, ge = -1, le = 100)
    minP: Optional[float] = Field(default = None, ge = 0, le = 1)
    repetitionPenalty: Optional[float] = Field(default = None, ge = 1, le = 2)
    presencePenalty: Optional[float] = Field(default = None, ge = 0, le = 2)
    # Not length-capped, like the installation-wide copy: truncating here would
    # silently change what the chat runs with.
    systemPrompt: Optional[str] = None
    systemVariables: Optional[str] = None


class ChatThread(BaseModel):
    id: str
    title: str = "New Chat"
    modelType: Literal["base", "lora", "model1", "model2"]
    modelId: str = ""
    pairId: Optional[str] = None
    projectId: Optional[str] = None
    archived: bool = False
    createdAt: int
    updatedAt: Optional[int] = None
    openaiCodeExecContainerId: Optional[str] = None
    anthropicCodeExecContainerId: Optional[str] = None
    forkedFromThreadId: Optional[str] = None
    forkedFromMessageId: Optional[str] = None
    settings: Optional[ChatThreadSettings] = None




class ChatThreadPatch(BaseModel):
    title: Optional[str] = None
    # Apply only while the row still holds this title, so a rename beats a background rewrite.
    expectedTitle: Optional[str] = None
    # Apply only while this is still the opening user message, so a title from a deleted one is rejected.
    expectedOpeningMessageId: Optional[str] = None
    modelType: Optional[Literal["base", "lora", "model1", "model2"]] = None
    modelId: Optional[str] = None
    pairId: Optional[str] = None
    projectId: Optional[str] = None
    archived: Optional[bool] = None
    createdAt: Optional[int] = None
    updatedAt: Optional[int] = None
    openaiCodeExecContainerId: Optional[str] = None
    anthropicCodeExecContainerId: Optional[str] = None
    # Replaces the whole snapshot, except for anything the client could not read.
    settings: Optional[ChatThreadSettings] = None
    # Applies just the fields it names. For the writer that knows what changed but not
    # what else the row holds, which is any write made before the row has been read.
    settingsPatch: Optional[ChatThreadSettings] = None
    # Orders this writer's snapshot writes against its OWN earlier ones, so a keepalive
    # sent on unload cannot be undone by a PATCH the server already had in hand. Never
    # compared across writers: two browsers' counters mean nothing to each other.
    settingsSeq: Optional[int] = None
    settingsWriter: Optional[str] = None


class ChatMessage(BaseModel):
    id: str
    threadId: str
    parentId: Optional[str] = None
    role: str
    content: Any = Field(default_factory = list)
    attachments: Optional[Any] = None
    metadata: Optional[dict[str, Any]] = None
    createdAt: int


class ChatProject(BaseModel):
    id: str
    name: str
    instructions: str = ""
    rootPath: Optional[str] = None
    sandboxPath: Optional[str] = None
    connectedFolderPath: Optional[str] = None
    workspaceAccess: str = "read"
    archived: bool = False
    createdAt: int
    updatedAt: int


class ChatProjectDeleted(ChatProject):
    """The deleted project, plus the member sandboxes that still hold files."""

    sandboxes_kept: list[str] = []


class ChatProjectPatch(BaseModel):
    name: Optional[str] = None
    instructions: Optional[str] = None
    archived: Optional[bool] = None
    createdAt: Optional[int] = None
    updatedAt: Optional[int] = None


class ChatProjectWorkspacePatch(BaseModel):
    # Explicit null means disconnect; omitting the field is a malformed request.
    connectedFolderPath: Optional[str] = Field(...)
    workspaceAccess: str = "read"


class ChatThreadWorkspacePatch(BaseModel):
    # A task/chat explicitly chooses its local working folder. This is not a
    # project source and never triggers RAG ingestion.
    folderPath: str = Field(min_length = 1)
    access: Literal["read", "write", "write_no_delete"] = "read"


class ChatThreadWorkspaceBinding(BaseModel):
    bindingId: str
    threadId: str
    id: str
    displayName: str
    canonicalPath: str
    filesystemIdentity: Optional[str] = None
    access: Literal["read", "write", "write_no_delete"]
    createdAt: int
    updatedAt: int
    lastUsedAt: Optional[int] = None
    boundAt: int


class ChatThreadListResponse(BaseModel):
    threads: list[ChatThread]


class ChatProjectListResponse(BaseModel):
    projects: list[ChatProject]


class ChatMessageListResponse(BaseModel):
    messages: list[ChatMessage]


class ChatMessageSyncRequest(BaseModel):
    messages: list[ChatMessage]
    pruneMissing: bool = False


class ChatDeleteRequest(BaseModel):
    ids: list[str]
    # Files a tool call wrote. Off by default: they are the user's and the chat
    # card offers them as downloads. An empty sandbox is removed either way.
    delete_files: bool = False


class ChatClearRequest(BaseModel):
    # The client fences every legacy Dexie thread it holds, so this bound has to sit above what
    # a migrated install can legitimately collect: a 422 here fails the whole clear, and the
    # identical retry fails with it, leaving backend history behind after Clear all.
    ids: list[str] = Field(default_factory = list, max_length = 200_000)
    operationId: Optional[str] = Field(default = None, min_length = 1, max_length = 128)


class ChatCountResponse(BaseModel):
    count: int


class ChatExportResponse(BaseModel):
    exportedAt: str
    version: int
    threadCount: int
    projects: list[ChatProject] = Field(default_factory = list)
    threads: list[ChatThread]
    messages: list[ChatMessage]


class ChatInferenceSettings(BaseModel):
    # allow_inf_nan: json.loads accepts bare NaN and Infinity, and pydantic takes them
    # for a float, so `{"temperature": NaN}` used to be stored as a bare NaN token in
    # value_json. Python reads that back, so the row is never quarantined, while the
    # response model renders it as null: the value is silently lost and the row is not
    # valid JSON for any strict reader. Refuse it at the door instead, the way
    # models/training.py already does for every numeric training field.
    model_config = ConfigDict(extra = "forbid", allow_inf_nan = False)

    temperature: Optional[float] = None
    topP: Optional[float] = None
    topK: Optional[float] = None
    minP: Optional[float] = None
    repetitionPenalty: Optional[float] = None
    presencePenalty: Optional[float] = None
    maxSeqLength: Optional[float] = None
    maxTokens: Optional[float] = None
    systemPrompt: Optional[str] = None
    systemVariables: Optional[str] = None
    trustRemoteCode: Optional[bool] = None
    fastMode: Optional[bool] = None


class ChatPresetLoadConfig(BaseModel):
    model_config = ConfigDict(extra = "forbid", allow_inf_nan = False)

    customContextLength: Optional[int] = Field(default = None, gt = 0)
    maxSeqLength: Optional[float] = None
    kvCacheDtype: Optional[str] = None
    mlxKvBits: Optional[Literal[8, 6, 5, 4, 3, 2]] = None
    speculativeType: Optional[str] = None
    specDraftNMax: Optional[int] = Field(default = None, ge = 1, le = 16)
    nParallel: Optional[int] = Field(default = None, ge = PARALLEL_MIN, le = PARALLEL_MAX)
    # The normalizer emits both keys on every preset (null included) and this model is
    # extra="forbid", so without them PUT /api/chat/settings 400s the whole save for any
    # preset carrying a loadConfig, including one that only pinned nParallel.
    nBatch: Optional[int] = Field(default = None, ge = BATCH_MIN, le = BATCH_MAX)
    nUbatch: Optional[int] = Field(default = None, ge = BATCH_MIN, le = BATCH_MAX)
    tensorParallel: Optional[bool] = None
    gpuMemoryMode: Optional[Literal["manual"]] = None
    gpuLayers: Optional[int] = None
    nCpuMoe: Optional[int] = Field(default = None, ge = 0)

    @field_validator("nBatch", "nUbatch", mode = "before")
    @classmethod
    def _no_booleans(cls, value: Any) -> Any:
        # Same contract as LoadRequest: bool subclasses int, so lax mode would store
        # `true` as 1 here while /load 422s it.
        if isinstance(value, bool):
            raise ValueError("Expected a number, got a boolean.")
        return value


class ChatPreset(BaseModel):
    model_config = ConfigDict(extra = "forbid")

    name: str
    params: ChatInferenceSettings
    loadConfig: Optional[ChatPresetLoadConfig] = None


class ChatResearchWebsitePolicy(BaseModel):
    model_config = ConfigDict(extra = "forbid")

    # 253 is the maximum length of a DNS name.
    allowedDomains: list[Annotated[str, Field(max_length = 253)]] = Field(
        default_factory = list, max_length = 1_000
    )
    blockedDomains: list[Annotated[str, Field(max_length = 253)]] = Field(
        default_factory = list, max_length = 1_000
    )


class ChatSettingsPayload(BaseModel):
    model_config = ConfigDict(extra = "forbid", allow_inf_nan = False)

    inferenceParams: Optional[ChatInferenceSettings] = None
    # Last-used params per checkpoint id. Deep-merged per key, so patching one
    # model cannot drop another's.
    inferenceParamsByModel: Optional[dict[str, ChatInferenceSettings]] = None
    rememberParamsPerModel: Optional[bool] = None
    customPresets: Optional[list[ChatPreset]] = None
    activePreset: Optional[str] = None
    activePresetSource: Optional[Literal["builtin-default", "custom", "modified"]] = None
    autoTitle: Optional[bool] = None
    reasoningEffort: Optional[
        Literal["none", "minimal", "low", "medium", "high", "max", "xhigh"]
    ] = None
    preserveThinking: Optional[bool] = None
    collapseHtmlArtifacts: Optional[bool] = None
    allowArtifactNetworkAccess: Optional[bool] = None
    autoHealToolCalls: Optional[bool] = None
    nudgeToolCalls: Optional[bool] = None
    maxToolCallsPerMessage: Optional[int] = Field(default = None, ge = 1)
    toolCallTimeout: Optional[int] = Field(default = None, ge = 1)

    # Composer and RAG toggles. They describe the installation, not the browser
    # that set them, so a second browser or a remote session reads them back here
    # instead of falling back to defaults.
    reasoningEnabled: Optional[bool] = None
    toolsEnabled: Optional[bool] = None
    codeToolsEnabled: Optional[bool] = None
    imageToolsEnabled: Optional[bool] = None
    webFetchToolsEnabled: Optional[bool] = None
    deepResearchEnabled: Optional[bool] = None
    researchWebsitePolicy: Optional[ChatResearchWebsitePolicy] = None
    # Seconds per Deep Research model request; zero leaves the total wall clock off. Bounded
    # like the run route so a value it would reject cannot be persisted and replayed.
    researchModelTimeoutSeconds: Optional[int] = Field(default = None, ge = 0, le = 365 * 24 * 3600)
    artifactsEnabled: Optional[bool] = None
    showCanvasMenuItem: Optional[bool] = None
    mcpEnabledForChat: Optional[bool] = None
    confirmToolCalls: Optional[bool] = None
    # "full" (Full access) is session-only by design and never persisted.
    permissionMode: Optional[Literal["ask", "auto", "off"]] = None
    ragSource: Optional[
        Annotated[
            Union[ChatRagThreadSource, ChatRagKnowledgeBaseSource],
            Field(discriminator = "type"),
        ]
    ] = None
    ragMode: Optional[Literal["hybrid", "lexical", "dense"]] = None
    # Matches the ge/le the retrieval endpoint enforces on its own top_k.
    ragTopK: Optional[int] = Field(default = None, ge = 1, le = 50)
    ragAutoInject: Optional[Literal["auto", "on", "off"]] = None
    ragAutoInjectMinScore: Optional[float] = Field(default = None, ge = 0, le = 1)
    ragOcrScanned: Optional[bool] = None
    ragCaptionFigures: Optional[bool] = None
    # Standing load preferences the model-load path reads outside the store.
    speculativeType: Optional[Literal["auto", "ngram", "off"]] = None
    gpuMemoryMode: Optional[Literal["auto", "manual"]] = None
    expandQuantizations: Optional[bool] = None
    showAllQuantizations: Optional[bool] = None
    fitOnDeviceOnly: Optional[bool] = None

    @field_validator("researchModelTimeoutSeconds", mode = "before")
    @classmethod
    def _not_a_boolean(cls, value: Any) -> Any:
        # bool subclasses int, so False coerces to the 0 sentinel and would persist as
        # unlimited for every later run. The run route rejects booleans for the same reason.
        if isinstance(value, bool):
            raise ValueError("researchModelTimeoutSeconds must be an integer, not a boolean")
        return value

    @field_validator("researchModelTimeoutSeconds")
    @classmethod
    def _run_route_accepts_it(cls, value: Optional[int]) -> Optional[int]:
        # The run route takes 0 (unlimited) or at least 10, so a persisted 1..9 would hydrate
        # and then 400 every later run with nothing pointing at this setting.
        if value is not None and 0 < value < 10:
            raise ValueError("researchModelTimeoutSeconds must be 0 (unlimited) or at least 10")
        return value


class ChatSettingsResponse(BaseModel):
    settings: dict[str, Any]


class ChatMessagesBatchRequest(BaseModel):
    threadIds: list[str]


class ChatMessagesBatchResponse(BaseModel):
    messagesByThreadId: dict[str, list[ChatMessage]]


class ChatImportLedgerResponse(BaseModel):
    threadIds: list[str]


class ChatImportLedgerRecordRequest(BaseModel):
    # 10k cap bounds the request body; real users have << 1k threads.
    threadIds: list[str] = Field(default_factory = list, max_length = 10_000)


class ChatImportLedgerRecordResponse(BaseModel):
    # accepted: deduped non-empty input count. inserted: rows actually new
    # (ON CONFLICT DO NOTHING skips already-recorded ids).
    accepted: int
    inserted: int



class ChatForkRequest(BaseModel):
    messageId: str
    newThreadId: str
    createdAt: int


class ChatForkResponse(BaseModel):
    thread: ChatThread
    messages: list[ChatMessage]
    containerSnapshotWarning: Optional[str] = None


class ChatForkCountResponse(BaseModel):
    count: int


class ChatThreadForkCountsResponse(BaseModel):
    counts: dict[str, int]


