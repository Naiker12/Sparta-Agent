"""Pydantic schemas and dataclasses for settings API."""

import re
from typing import Any, List, Literal, Optional, get_args
from pydantic import BaseModel, ConfigDict, Field, StrictBool, ValidationError, field_validator

from utils.personalization_settings import (
    MAX_AVATAR_DATA_URL_BYTES,
    PERSONALIZATION_VERSION,
)
from picker.schemas import MAX_CHAT_TEMPLATE_BYTES, chat_template_byte_length
from utils.upload_limits import MAX_UPLOAD_LIMIT_MB, MIN_UPLOAD_LIMIT_MB
from utils.coding_agents import CODING_AGENTS
from utils.helper_precache_settings import DEFAULT_HELPER_PRECACHE_ENABLED
from utils.model_memory_settings import DEFAULT_KEEP_RESIDENT, DEFAULT_NO_RAM_RESERVE
from utils.vram_budget_settings import (
    VRAM_FRACTION_DEFAULT,
    VRAM_FRACTION_MAX,
    VRAM_FRACTION_MIN,
)
from utils.openai_auto_switch_settings import (
    BATCH_SIZE_MAX,
    BATCH_SIZE_MIN,
    DEFAULT_AUTO_UNLOAD_API_ONLY,
    DEFAULT_AUTO_UNLOAD_KEEP_KV,
    DEFAULT_MEDIA_AUTO_SWITCH_ENABLED,
    DEFAULT_MEDIA_AUTO_UNLOAD_IDLE_SECONDS,
    DEFAULT_OPENAI_AUTO_DOWNLOAD_ENABLED,
    DEFAULT_OPENAI_AUTO_SWITCH_ENABLED,
    MAX_GPU_ID,
    PARALLEL_SLOTS_MAX,
    PARALLEL_SLOTS_MIN,
)
from utils.preview_sharing_settings import DEFAULT_PREVIEW_SHARING_ENABLED
from utils.remote_access_settings import DEFAULT_REMOTE_ACCESS_AUTO_START
from utils.llama_cpp_path_settings import MAX_CUSTOM_LLAMA_CPP_PATH_LENGTH
from utils.embedding_model_settings import MAX_EMBEDDING_MODEL_LENGTH

class ImageGenerationPresetParams(BaseModel):
    """Bounds track DiffusionGenerateRequest. A preset the generate endpoint would refuse is not
    a usable preset: selecting it would make every following Generate fail validation."""

    model_config = ConfigDict(extra = "forbid")

    negativePrompt: str = ""
    width: int = Field(default = 1024, ge = 256, le = 2048, multiple_of = 16)
    height: int = Field(default = 1024, ge = 256, le = 2048, multiple_of = 16)
    steps: int = Field(default = 9, ge = 1, le = 100)
    guidance: float = Field(default = 0, ge = 0, le = 20)
    batchSize: int = Field(default = 1, ge = 1, le = 32)
    runs: int = Field(default = 1, ge = 1)


class VideoGenerationPresetParams(BaseModel):
    """Bounds track VideoGenerateRequest, as the image params track theirs."""

    model_config = ConfigDict(extra = "forbid")

    negativePrompt: str = ""
    width: int = Field(default = 768, ge = 32, le = 2048)
    height: int = Field(default = 512, ge = 32, le = 2048)
    durationSeconds: float = Field(default = 3, gt = 0, le = 3600)
    steps: int = Field(default = 8, ge = 1, le = 100)
    guidance: float = Field(default = 1, ge = 0, le = 20)
    flowShift: Optional[float] = Field(default = None, gt = 0, le = 100)
    audioFlowShift: Optional[float] = Field(default = None, gt = 0, le = 100)


class MediaGenerationPreset(BaseModel):
    model_config = ConfigDict(extra = "forbid")

    name: str = Field(..., min_length = 1, max_length = 80)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = value.strip()
        if not name or name == "Default":
            raise ValueError("Preset name is reserved or empty")
        return name


class ImageGenerationPreset(MediaGenerationPreset):
    params: ImageGenerationPresetParams


class VideoGenerationPreset(MediaGenerationPreset):
    params: VideoGenerationPresetParams


class MediaGenerationPresetState(BaseModel):
    """A saved generation recipe and the selection that owns it.

    Model-load options are deliberately not here: they take effect only on a reload, they follow
    the hardware and the checkpoint rather than the recipe, and the resident build already reports
    them, so a second stored copy would only ever compete with it.
    """

    model_config = ConfigDict(extra = "forbid")

    activePreset: str = Field(default = "Default", min_length = 1, max_length = 80)


class ImageGenerationPresetState(MediaGenerationPresetState):
    currentParams: ImageGenerationPresetParams = Field(default_factory = ImageGenerationPresetParams)


class VideoGenerationPresetState(MediaGenerationPresetState):
    currentParams: VideoGenerationPresetParams = Field(default_factory = VideoGenerationPresetParams)


class ImageGenerationPresetSettings(ImageGenerationPresetState):
    # No cap on the read: upsert_media_generation_preset owns the limit, and refusing to
    # report a store that somehow exceeds it would only turn a GET into a 500.
    customPresets: list[ImageGenerationPreset] = Field(default_factory = list)
    saved: bool = False


class VideoGenerationPresetSettings(VideoGenerationPresetState):
    # No cap on the read: upsert_media_generation_preset owns the limit, and refusing to
    # report a store that somehow exceeds it would only turn a GET into a 500.
    customPresets: list[VideoGenerationPreset] = Field(default_factory = list)
    saved: bool = False


class UploadLimitPayload(BaseModel):
    max_upload_size_mb: int = Field(..., ge = MIN_UPLOAD_LIMIT_MB, le = MAX_UPLOAD_LIMIT_MB)


class UploadLimitResponse(BaseModel):
    max_upload_size_mb: int
    max_upload_size_bytes: int
    max_upload_size_label: str
    default_upload_size_mb: int
    min_upload_size_mb: int = MIN_UPLOAD_LIMIT_MB
    max_allowed_upload_size_mb: int = MAX_UPLOAD_LIMIT_MB


class HuggingFaceTokenPayload(BaseModel):
    token: str = Field(..., min_length = 1, max_length = 512)

    @field_validator("token")
    @classmethod
    def normalize_token(cls, value: str) -> str:
        normalized = value.strip(" \t\r\n\"'")
        if not normalized:
            raise ValueError("Hugging Face token cannot be empty")
        return normalized


class HuggingFaceTokenResponse(BaseModel):
    token: Optional[str] = None
    has_token: bool = False



class HelperPrecachePayload(BaseModel):
    enabled: bool


class HelperPrecacheResponse(BaseModel):
    enabled: bool
    default_enabled: bool = DEFAULT_HELPER_PRECACHE_ENABLED
    disabled_by_env: bool


class ModelMemoryPayload(BaseModel):
    # None leaves the stored value untouched, so the switches save independently.
    keep_resident: Optional[bool] = None
    no_ram_reserve: Optional[bool] = None


class ModelMemoryResponse(BaseModel):
    keep_resident: bool
    no_ram_reserve: bool
    default_keep_resident: bool = DEFAULT_KEEP_RESIDENT
    default_no_ram_reserve: bool = DEFAULT_NO_RAM_RESERVE
    # Whether --mlock is passed on the next load. False when no_ram_reserve
    # vetoes it; the UI surfaces that rather than failing silently.
    mlock_active: bool
    reload_required: bool
    # Soft RLIMIT_MEMLOCK when finite. mlock cannot exceed it, so the UI warns
    # that residency will not fully pin a model larger than this. None means
    # unlimited (macOS) or not applicable (Windows).
    memlock_limit_bytes: Optional[int] = None


class VramBudgetPayload(BaseModel):
    # None clears the stored budget so env/default applies again; it cannot also
    # mean "leave untouched" as the model-memory switches do, since there is one
    # field. Hence required, not defaulted: with a default, {} would mean "clear it"
    # and a client that dropped the field would silently discard the stored budget.
    fraction: Optional[float] = Field(ge = VRAM_FRACTION_MIN, le = VRAM_FRACTION_MAX)

    @field_validator("fraction", mode = "before")
    @classmethod
    def _reject_bool(cls, value: object) -> object:
        # bool subclasses int, so non-strict parsing turns True into 1.0 and stores
        # the max budget instead of 422; pydantic coerces before the util's guard.
        if isinstance(value, bool):
            raise ValueError("fraction must be a number, not a boolean")
        return value


class VramBudgetResponse(BaseModel):
    fraction: float
    # False when inherited from UNSLOTH_VRAM_FRACTION or the default, so the UI
    # knows whether clearing it would change anything.
    is_stored: bool
    default_fraction: float = VRAM_FRACTION_DEFAULT
    min_fraction: float = VRAM_FRACTION_MIN
    max_fraction: float = VRAM_FRACTION_MAX
    # Read when a load sizes itself, so a change cannot reach a running child.
    reload_required: bool


class HuggingFaceCachePayload(BaseModel):
    cache_home: Optional[str] = Field(default = None, max_length = 4096)


class HuggingFaceCacheResponse(BaseModel):
    cache_home: str
    hub_cache: str
    xet_cache: str
    source: Literal["default", "studio", "environment"]
    editable: bool
    is_custom: bool
    available: bool
    writable: bool
    free_bytes: Optional[int] = None
    environment_variable: Optional[str] = None


class LlamaCppPathPayload(BaseModel):
    path: Optional[str] = Field(default = None, max_length = MAX_CUSTOM_LLAMA_CPP_PATH_LENGTH)


class LlamaCppPathResponse(BaseModel):
    path: Optional[str] = None
    source: Literal["default", "studio", "environment"]
    editable: bool
    available: bool
    resolved_binary: Optional[str] = None
    environment_variable: Optional[str] = None
    reload_required: bool = False


class OpenAIAutoSwitchPayload(BaseModel):
    enabled: bool
    # None leaves the stored value untouched (partial updates can't clobber it).
    auto_unload_idle_seconds: Optional[int] = Field(default = None, ge = 0)
    auto_unload_keep_kv: Optional[bool] = None
    auto_download_model: Optional[bool] = None
    auto_unload_api_only: Optional[bool] = None
    # The image/video TTL is its own setting, not a share of the chat one.
    media_auto_unload_idle_seconds: Optional[int] = Field(default = None, ge = 0)
    # And so is image/video auto-switch, for the same reason.
    media_auto_switch_model: Optional[bool] = None


class OpenAIAutoSwitchResponse(BaseModel):
    enabled: bool
    auto_unload_idle_seconds: int
    default_enabled: bool = DEFAULT_OPENAI_AUTO_SWITCH_ENABLED
    # True when the idle-unload loop will actually unload (effective TTL > 0). With
    # UNSLOTH_MODEL_IDLE_TTL set and nothing stored, this is true even while enabled
    # is false, so the UI can show idle-unload as active instead of "needs enable".
    idle_unload_active: bool = False
    auto_unload_keep_kv: bool = DEFAULT_AUTO_UNLOAD_KEEP_KV
    # Stored, not effective: the UI must round-trip the saved value across an auto-switch toggle.
    auto_download_model: bool = DEFAULT_OPENAI_AUTO_DOWNLOAD_ENABLED
    # When true, the idle unload spares models loaded from the UI, not just via the API.
    auto_unload_api_only: bool = DEFAULT_AUTO_UNLOAD_API_ONLY
    # Stored, then effective: the UI shows the saved seconds and flags when a veto
    # (residency, or API-loaded only) is holding the image/video unload off.
    media_auto_unload_idle_seconds: int = DEFAULT_MEDIA_AUTO_UNLOAD_IDLE_SECONDS
    media_idle_unload_active: bool = False
    # When true, a media request may load the image or video model it names.
    media_auto_switch_model: bool = DEFAULT_MEDIA_AUTO_SWITCH_ENABLED


# A quant suffix, as modelOverrideKey builds it. Matched against the loader's quant pattern,
# not a length heuristic: a POSIX path may hold a colon and inherit another model's flags.
_MAX_VARIANT_SUFFIX_LEN = 64

# A local id is a path plus an optional quant suffix, and LoadRequest.model_path is unbounded.
# A limit under PATH_MAX would 422 the server sync while the local save succeeded.
MAX_MODEL_OVERRIDE_KEY_LEN = 4096 + 1 + _MAX_VARIANT_SUFFIX_LEN

# GgufVariantDetail.quant may be a path-qualified variant key, not just a quant suffix.
MAX_GGUF_VARIANT_KEY_LEN = 4096

# A list longer than MAX_GPU_ID cannot name a device the normalizer would store, so bound it
# here and reject an oversized array at the boundary instead of walking it.
MAX_GPU_IDS = MAX_GPU_ID + 1


class ModelOverridePayload(BaseModel):
    """One model's saved launch config, applied when the API loads that model.

    Everything past ``model_id`` is optional and omitted means "app default", so a
    payload carrying only ``model_id`` clears the entry. The bounds here mirror
    ``LoadRequest`` so a bad value is rejected at the boundary instead of being
    silently dropped by the normalizer; the enum-ish fields (KV dtype, speculative
    mode) are left to it, since their valid sets follow the llama.cpp build.
    """

    model_id: str = Field(..., min_length = 1, max_length = MAX_MODEL_OVERRIDE_KEY_LEN)
    # None leaves the stored value alone (the UI has no control for flags); [] clears them.
    llama_extra_args: Optional[list[str]] = None
    # ge=1: the setter drops a falsy value, so reject 0 here instead of discarding it silently.
    max_seq_length: Optional[int] = Field(default = None, ge = 1, le = 1048576)
    custom_context_length: Optional[int] = Field(default = None, ge = 1, le = 1048576)
    kv_cache_dtype: Optional[str] = Field(default = None, max_length = 32)
    # A discrete set, enforced by the normalizer; these bounds only block absurd values.
    mlx_kv_bits: Optional[int] = Field(default = None, ge = 2, le = 8)
    speculative_type: Optional[str] = Field(default = None, max_length = 32)
    spec_draft_n_max: Optional[int] = Field(default = None, ge = 1, le = 16)
    # Parallel decode slots (llama-server --parallel), GGUF-only; None follows the server default.
    n_parallel: Optional[int] = Field(default = None, ge = PARALLEL_SLOTS_MIN, le = PARALLEL_SLOTS_MAX)
    # prompt batch sizes (--batch-size / --ubatch-size), gguf-only; none = llama.cpp defaults
    n_batch: Optional[int] = Field(default = None, ge = BATCH_SIZE_MIN, le = BATCH_SIZE_MAX)
    n_ubatch: Optional[int] = Field(default = None, ge = BATCH_SIZE_MIN, le = BATCH_SIZE_MAX)
    tensor_parallel: bool = False
    # Validated in bytes below: pydantic counts characters, so a multi-byte template would pass.
    chat_template_override: Optional[str] = None
    gpu_memory_mode: Optional[Literal["auto", "manual"]] = None
    # -1 is Auto (llama.cpp --fit sizes the offload); the normalizer treats it as unset.
    gpu_layers: Optional[int] = Field(default = None, ge = -1, le = 1024)
    n_cpu_moe: Optional[int] = Field(default = None, ge = 0, le = 1024)
    gpu_ids: Optional[list[int]] = Field(default = None, max_length = MAX_GPU_IDS)
    # An all-default save carries no fields, like a forget; None keeps the legacy contract.
    remove: Optional[bool] = None
    # Fill in, don't replace: the backfill reads the map once then writes each model, so another
    # tab's save was overwritten by this browser's older copy. Field level, not entry level: a
    # legacy entry holds only some fields, and skipping it would strand the rest.
    fill_absent_fields: bool = False

    @field_validator("chat_template_override")
    @classmethod
    def _limit_chat_template_bytes(cls, value: Optional[str]) -> Optional[str]:
        # Mirrors LoadRequest.normalize_blank_chat_template_override.
        if value is None:
            return None
        size = chat_template_byte_length(value)
        if size is None:
            raise ValueError("Chat template contains unpaired surrogate characters.")
        if size > MAX_CHAT_TEMPLATE_BYTES:
            raise ValueError(f"Chat template exceeds the {MAX_CHAT_TEMPLATE_BYTES}-byte limit.")
        return value

    @field_validator(
        "max_seq_length",
        "custom_context_length",
        "spec_draft_n_max",
        "n_parallel",
        "n_batch",
        "n_ubatch",
        "gpu_layers",
        "n_cpu_moe",
        "gpu_ids",
        mode = "before",
    )
    @classmethod
    def _no_booleans(cls, value: Any) -> Any:
        # bool subclasses int and pydantic parses non-strictly, so `true` arrives as 1: a
        # payload could pin GPU 1 or set a one-token context. _bounded_int rejects bools but
        # never sees one, since coercion happens here first. Only bools, so lax parsing stays.
        if isinstance(value, bool):
            raise ValueError("Expected a number, got a boolean.")
        if isinstance(value, list) and any(isinstance(item, bool) for item in value):
            raise ValueError("Expected numbers, got a boolean.")
        return value


class ModelOverridesResponse(BaseModel):
    overrides: dict[str, dict]
    # Filled only when the caller named a model: the entry ITS load would apply,
    # resolved here rather than in the browser. The folding rules are Python's
    # (casefold is not toLowerCase, and an ambiguous fold matches nothing on
    # purpose), so a client mirroring them can only approximate.
    resolved: Optional[dict] = None
    resolved_key: Optional[str] = None

_LAST_LOCAL_MODEL_CLOCK_SLACK_MS = 5 * 60 * 1000


class LastLocalModelPayload(BaseModel):
    id: str = Field(..., min_length = 1, max_length = MAX_MODEL_OVERRIDE_KEY_LEN)
    kind: Literal["gguf", "model"]
    gguf_variant: Optional[str] = Field(default = None, max_length = MAX_GGUF_VARIANT_KEY_LEN)
    # Epoch ms of the load; orders writes from surfaces that keep their own local shadow.
    loaded_at: Optional[int] = Field(default = None, ge = 0)
    # The client clock when the request was sent: the skew (server_now - client_now)
    # translates loaded_at into the server frame. Never persisted.
    client_now: Optional[int] = Field(default = None, ge = 0)


class LastLocalModelResponse(BaseModel):
    id: Optional[str] = None
    kind: Optional[Literal["gguf", "model"]] = None
    gguf_variant: Optional[str] = None
    loaded_at: Optional[int] = None
    # Lets the client translate loaded_at back into its own clock frame.
    server_now: Optional[int] = None

class CodingAgentsResponse(BaseModel):
    # All agents `unsloth start` supports, in the CLI's declared order.
    agents: tuple[str, ...] = CODING_AGENTS
    # Subset of `agents` whose CLI binary was found on PATH; the frontend uses
    # this to default the API-keys panel to a command the user can run as-is.
    detected: list[str]

class EmbeddingModelPayload(BaseModel):
    embedding_model: str = Field(..., min_length = 1, max_length = MAX_EMBEDDING_MODEL_LENGTH)
    # Token for gated/private repos during verification (not stored).
    hf_token: Optional[str] = Field(default = None, max_length = 512)
    # Skip HF verification (offline installs, local paths HF can't see).
    force: bool = False


class EmbeddingModelResponse(BaseModel):
    embedding_model: str
    embedding_gguf_repo: str
    default_embedding_model: str
    default_embedding_gguf_repo: str
    is_custom: bool

class PreviewLinkRotateResponse(BaseModel):
    rotated: bool = True

class PreviewSharingPayload(BaseModel):
    enabled: bool


class PreviewSharingResponse(BaseModel):
    enabled: bool
    default_enabled: bool = DEFAULT_PREVIEW_SHARING_ENABLED


class RemoteAccessAutoStartPayload(BaseModel):
    enabled: StrictBool


class RemoteAccessResponse(BaseModel):
    state: Literal["off", "starting", "online", "stopping", "error"]
    url: Optional[str] = None
    error: Optional[str] = None
    auto_start: bool
    default_auto_start: bool = DEFAULT_REMOTE_ACCESS_AUTO_START
    available: bool
    managed_by: Optional[Literal["launch", "settings", "colab"]] = None
    can_start: bool
    can_stop: bool
    block_reason: Optional[str] = None
    password_pending: bool = False
    streaming_supported: bool = True

class LanAccessAutoStartPayload(BaseModel):
    enabled: StrictBool


class LanAccessResponse(BaseModel):
    state: Literal["off", "online", "error"]
    urls: list[str] = []
    public_urls: list[str] = []
    error: Optional[str] = None
    auto_start: bool
    managed_by: Optional[Literal["launch", "settings"]] = None
    can_start: bool
    can_stop: bool
    block_reason: Optional[str] = None
    serves_web_ui: bool = True

def _is_bundled_avatar_url(value: str) -> bool:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return False
    path = unquote(parsed.path).lstrip("/")
    if ".." in path.split("/"):
        return False
    marker = "Sloth emojis/"
    if marker not in path:
        return False
    return path[path.index(marker) :].lower().endswith(".png")

class PersonalizationProfile(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    displayName: str = Field("", max_length = 200)
    nickname: str = Field("", max_length = 200)
    avatarDataUrl: Optional[str] = Field(None, max_length = MAX_AVATAR_DATA_URL_BYTES)
    avatarShape: Literal["circle", "rounded"] = "circle"
    showGreetingSloth: bool = True

    @field_validator("avatarDataUrl")
    @classmethod
    def _validate_avatar(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        if not value.startswith("data:image/") and not _is_bundled_avatar_url(value):
            raise ValueError("avatarDataUrl must be an image data URL or bundled avatar.")
        return value


class PersonalizationCustomColors(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    accent: Optional[str] = Field(None, pattern = r"^#[0-9a-fA-F]{6}$")
    background: Optional[str] = Field(None, pattern = r"^#[0-9a-fA-F]{6}$")
    foreground: Optional[str] = Field(None, pattern = r"^#[0-9a-fA-F]{6}$")


class PersonalizationCustomColorModes(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    light: PersonalizationCustomColors = Field(default_factory = PersonalizationCustomColors)
    dark: PersonalizationCustomColors = Field(default_factory = PersonalizationCustomColors)


MAX_IMPORTED_FONTS = 3
# ~1.5 MB font file as base64; matches MAX_IMPORTED_FONT_DATA_URL_LENGTH in
# the frontend appearance-custom-store.
MAX_FONT_DATA_URL_LENGTH = 2_200_000
# Aggregate cap across all imported fonts; matches
# MAX_TOTAL_IMPORTED_FONT_DATA_URL_LENGTH in the frontend so a synced payload
# always fits the browser's localStorage quota.
MAX_TOTAL_FONT_DATA_URL_LENGTH = 4_400_000

# Characters that could terminate a CSS declaration, escape the quoted
# font-family value (backslash), or smuggle extra fallbacks/comments (comma,
# slash) if a stored name ever reached a stylesheet. The server is the
# authoritative gate; the frontend strips the same set before use.
_FONT_NAME_FORBIDDEN = set(";{}()<>\"'\\/,`")


def _check_font_name(value: str) -> str:
    if any(c in _FONT_NAME_FORBIDDEN or ord(c) < 0x20 for c in value):
        raise ValueError("Font name contains invalid characters.")
    return value


# Matches FONT_DATA_URL_PATTERN in the frontend appearance-custom-store.
_FONT_DATA_URL_PATTERN = re.compile(
    r"^data:(?:font/(?:woff2?|ttf|otf|sfnt)"
    r"|application/(?:octet-stream|x-font-\w+|font-\w+));base64,[A-Za-z0-9+/=]+$"
)


class PersonalizationImportedFont(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    name: str = Field(..., min_length = 1, max_length = 100)
    dataUrl: str = Field(..., max_length = MAX_FONT_DATA_URL_LENGTH)

    @field_validator("name")
    @classmethod
    def _validate_font_name(cls, value: str) -> str:
        return _check_font_name(value)

    @field_validator("dataUrl")
    @classmethod
    def _validate_font_data_url(cls, value: str) -> str:
        # fullmatch, not match: re's ``$`` also matches just before a trailing
        # newline, so ``match`` would accept "data:font/woff2;base64,AAAA\n",
        # which the frontend's JS pattern (``$`` = end of string) rejects.
        if not _FONT_DATA_URL_PATTERN.fullmatch(value):
            raise ValueError("dataUrl must be a base64 font data URL.")
        return value

SIDEBAR_MENU_ITEM_DEFAULTS = {
    "api": True,
    "darkMode": True,
    "guidedTour": True,
    "profile": False,
    "appearance": False,
    "resources": False,
    "chat": False,
    "connections": False,
}

# Navigable sidebar rows the user can pin/reorder; the boolean is each id's default pin state.
# Order and pin state MUST match the frontend's shipped layout (SIDEBAR_NAV_ITEM_IDS /
# SIDEBAR_NAV_DEFAULT_PINNED in features/settings/stores/appearance-custom-store.ts): the client
# sends every id on each save, so a missing id 422s the whole personalization PUT, and a legacy
# record that predates sidebarNav is served this default as if it were an explicit remote choice.
SIDEBAR_NAV_ITEM_DEFAULTS = {
    "hub": True,
    "projects": True,
    "images": True,
    "video": True,
    "audio": False,
    "recipes": False,
    "export": False,
    "api": False,
}

MAX_SIDEBAR_NAV_INPUT_ITEMS = 4 * len(SIDEBAR_NAV_ITEM_DEFAULTS)

# The sidebarMenu validator below dedupes ids and re-fills any missing ones, so
# the stored list is always exactly one entry per id. Cap the *incoming* list at
# a generous multiple rather than len(defaults): a stale or duplicated payload
# (more items than distinct ids) must reach the validator so it can normalize,
# instead of being rejected by the length constraint before dedupe runs. A
# pathologically long list is still refused.
MAX_SIDEBAR_MENU_INPUT_ITEMS = 4 * len(SIDEBAR_MENU_ITEM_DEFAULTS)


class PersonalizationSidebarMenuItem(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    id: Literal[
        "api",
        "darkMode",
        "guidedTour",
        "profile",
        "appearance",
        "resources",
        "chat",
        "connections",
    ]
    visible: bool = True


def _default_sidebar_menu() -> "list[PersonalizationSidebarMenuItem]":
    return [
        PersonalizationSidebarMenuItem(id = item_id, visible = visible)
        for item_id, visible in SIDEBAR_MENU_ITEM_DEFAULTS.items()
    ]


class PersonalizationSidebarNavItem(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    id: Literal[
        "hub",
        "projects",
        "images",
        "video",
        "audio",
        "train",
        "recipes",
        "export",
        "api",
    ]
    pinned: bool = True


def _default_sidebar_nav() -> "list[PersonalizationSidebarNavItem]":
    return [
        PersonalizationSidebarNavItem(id = item_id, pinned = pinned)
        for item_id, pinned in SIDEBAR_NAV_ITEM_DEFAULTS.items()
    ]


class PersonalizationCustomization(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    colors: PersonalizationCustomColorModes = Field(default_factory = PersonalizationCustomColorModes)
    uiFont: Optional[str] = Field(None, max_length = 200)
    headingFont: Optional[str] = Field(None, max_length = 200)
    chatFont: Optional[str] = Field(None, max_length = 200)
    codeFont: Optional[str] = Field(None, max_length = 200)
    importedFonts: list[PersonalizationImportedFont] = Field(
        default_factory = list, max_length = MAX_IMPORTED_FONTS
    )

    @field_validator("importedFonts")
    @classmethod
    def _validate_total_font_size(
        cls, value: list[PersonalizationImportedFont]
    ) -> list[PersonalizationImportedFont]:
        if sum(len(f.dataUrl) for f in value) > MAX_TOTAL_FONT_DATA_URL_LENGTH:
            raise ValueError("Imported fonts exceed the total size limit.")
        return value

    @field_validator("uiFont", "headingFont", "chatFont", "codeFont")
    @classmethod
    def _validate_selected_fonts(cls, value: Optional[str]) -> Optional[str]:
        # Selected font names reach CSS the same way imported names do.
        return value if value is None else _check_font_name(value)

    uiFontSize: Optional[int] = Field(None, ge = 12, le = 20)
    codeFontSize: Optional[int] = Field(None, ge = 10, le = 20)
    contrast: int = Field(50, ge = 0, le = 100)
    pointerCursors: bool = False
    reduceMotion: Literal["system", "on", "off"] = "system"
    fontSmoothing: bool = True
    sidebarMenu: list[PersonalizationSidebarMenuItem] = Field(
        default_factory = _default_sidebar_menu,
        max_length = MAX_SIDEBAR_MENU_INPUT_ITEMS,
    )
    # Order is the sidebar's render order, so the validator keeps the client's.
    sidebarNav: list[PersonalizationSidebarNavItem] = Field(
        default_factory = _default_sidebar_nav,
        max_length = MAX_SIDEBAR_NAV_INPUT_ITEMS,
    )

    @field_validator("sidebarMenu")
    @classmethod
    def _validate_sidebar_menu(
        cls, value: list[PersonalizationSidebarMenuItem]
    ) -> list[PersonalizationSidebarMenuItem]:
        # Drop duplicate ids (keep the first) and re-append any missing ids so
        # the stored list always covers every optional menu item exactly once.
        seen: set[str] = set()
        items = [item for item in value if not (item.id in seen or seen.add(item.id))]
        for item_id, visible in SIDEBAR_MENU_ITEM_DEFAULTS.items():
            if item_id not in seen:
                items.append(PersonalizationSidebarMenuItem(id = item_id, visible = visible))
        return items

    @field_validator("sidebarNav")
    @classmethod
    def _validate_sidebar_nav(
        cls, value: list[PersonalizationSidebarNavItem]
    ) -> list[PersonalizationSidebarNavItem]:
        # Like sidebarMenu, but order is preserved: dedupe, then append missing.
        seen: set[str] = set()
        items = [item for item in value if not (item.id in seen or seen.add(item.id))]
        for item_id, pinned in SIDEBAR_NAV_ITEM_DEFAULTS.items():
            if item_id not in seen:
                items.append(PersonalizationSidebarNavItem(id = item_id, pinned = pinned))
        return items


class PersonalizationAppearance(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    theme: Literal["light", "dark", "system"] = "system"
    palette: Literal["standard", "classic", "minimal"] = "standard"
    language: Optional[str] = Field(None, max_length = 20)
    customization: PersonalizationCustomization = Field(
        default_factory = PersonalizationCustomization
    )


class PersonalizationPayload(BaseModel):
    model_config = ConfigDict(extra = "ignore")

    version: int = PERSONALIZATION_VERSION
    profile: PersonalizationProfile = Field(default_factory = PersonalizationProfile)
    appearance: PersonalizationAppearance = Field(default_factory = PersonalizationAppearance)


class PersonalizationResponse(PersonalizationPayload):
    saved: bool = False
    # False when the stored record predates a field, so the client keeps local
    # overrides instead of treating a server-filled default as an explicit value.
    customizationSaved: bool = False
    paletteSaved: bool = False
    greetingSlothSaved: bool = False

class DebugLogSourceModel(BaseModel):
    id: str
    family: str
    label: str
    realpath: str
    size_bytes: int
    modified_at: float
    is_current: bool


class DebugLogSourcesResponse(BaseModel):
    sources: list[DebugLogSourceModel]
    default_source_id: Optional[str] = None
    file_logging_disabled: bool = False


class DebugLogResponse(BaseModel):
    status: Literal["ok", "empty", "missing", "unreadable", "disabled"]
    reason: Optional[str] = None
    source_id: Optional[str] = None
    realpath: Optional[str] = None
    lines: list[str] = Field(default_factory = list)
    cursor: Optional[str] = None
    reset: bool = False
    reset_reason: Optional[str] = None
    dropped_bytes: int = 0
    truncated_head: bool = False
    # The reader stopped at the response cap and the rest arrives on the next
    # poll. Without this the caller cannot tell a complete answer from a partial
    # one, which is invisible in manual mode because no next poll is coming.
    more_pending: bool = False
    # File logging is off, so anything readable here is a PREVIOUS session and
    # will never grow. The status stays "ok" because the content is real and
    # worth reading; saying nothing made a stale log look live.
    file_logging_disabled: bool = False
    size_bytes: int = 0
