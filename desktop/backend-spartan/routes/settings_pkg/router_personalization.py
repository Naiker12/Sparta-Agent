"""UI personalization, themes, custom colors, fonts and sidebar menu settings."""

from urllib.parse import unquote, urlsplit
from fastapi import APIRouter, Depends, HTTPException
from loggers import get_logger

from auth.authentication import get_current_subject
from utils.personalization_settings import (
    get_personalization,
    set_personalization,
)
from routes.settings_pkg.schemas import (
    PersonalizationProfile,
    PersonalizationCustomColors,
    PersonalizationCustomColorModes,
    PersonalizationImportedFont,
    PersonalizationSidebarMenuItem,
    PersonalizationSidebarNavItem,
    PersonalizationCustomization,
    PersonalizationAppearance,
    PersonalizationPayload,
    PersonalizationResponse,
    MAX_IMPORTED_FONTS,
    MAX_FONT_DATA_URL_LENGTH,
    MAX_TOTAL_FONT_DATA_URL_LENGTH,
    SIDEBAR_MENU_ITEM_DEFAULTS,
    SIDEBAR_NAV_ITEM_DEFAULTS,
    MAX_SIDEBAR_NAV_INPUT_ITEMS,
    MAX_SIDEBAR_MENU_INPUT_ITEMS,
)

router = APIRouter()
logger = get_logger(__name__)

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

@router.get("/personalization", response_model = PersonalizationResponse)
def get_personalization_settings(
    current_subject: str = Depends(get_current_subject),
) -> PersonalizationResponse:
    stored = get_personalization()
    response = PersonalizationResponse.model_validate(stored or {})
    response.saved = bool(stored)
    appearance = stored.get("appearance") if isinstance(stored, dict) else None
    profile = stored.get("profile") if isinstance(stored, dict) else None
    response.customizationSaved = isinstance(appearance, dict) and "customization" in appearance
    response.paletteSaved = isinstance(appearance, dict) and "palette" in appearance
    response.greetingSlothSaved = isinstance(profile, dict) and "showGreetingSloth" in profile
    return response


def _merge_personalization(base: dict, overlay: dict) -> dict:
    # Recursively overlay only the request's set fields onto the stored record,
    # so a stale client that omits newer keys (palette, customization) does not
    # materialize their defaults and defeat the *Saved legacy detection.
    merged = dict(base)
    for key, value in overlay.items():
        existing = merged.get(key)
        if isinstance(value, dict) and isinstance(existing, dict):
            merged[key] = _merge_personalization(existing, value)
        else:
            merged[key] = value
    return merged


@router.put("/personalization", response_model = PersonalizationPayload)
def update_personalization_settings(
    payload: PersonalizationPayload, current_subject: str = Depends(get_current_subject)
) -> PersonalizationPayload:
    try:
        # exclude_unset so absent fields are not persisted as defaults; merge so
        # fields the request omits keep whatever the record already stored.
        incoming = payload.model_dump(exclude_unset = True)
        merged = _merge_personalization(get_personalization(), incoming)
        set_personalization(merged)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid personalization settings."),
            event = "settings.update_personalization_failed",
            log = logger,
        ) from exc
    # Return the stored record, not the defaults-filled request, so the response
    # matches storage (and the next GET) for fields the client omitted.
    return PersonalizationPayload.model_validate(merged)
