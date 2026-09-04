"""Image and video generation preset settings and custom recipes."""

import functools
from typing import Any, Literal, Optional, get_args
from fastapi import APIRouter, Depends, HTTPException
from loggers import get_logger
from pydantic import BaseModel, ValidationError

from auth.authentication import get_current_subject
from utils.media_generation_preset_settings import (
    delete_media_generation_preset,
    get_media_generation_preset_settings,
    set_media_generation_preset_settings,
    upsert_media_generation_preset,
)
from routes.settings_pkg.schemas import (
    ImageGenerationPresetParams,
    VideoGenerationPresetParams,
    MediaGenerationPreset,
    ImageGenerationPreset,
    VideoGenerationPreset,
    MediaGenerationPresetState,
    ImageGenerationPresetState,
    VideoGenerationPresetState,
    ImageGenerationPresetSettings,
    VideoGenerationPresetSettings,
)

router = APIRouter()
logger = get_logger(__name__)

def _nested_model(annotation: Any) -> Optional[type[BaseModel]]:
    for candidate in (annotation, *get_args(annotation)):
        if isinstance(candidate, type) and issubclass(candidate, BaseModel):
            return candidate
    return None


def _readable(model: type[BaseModel], value: Any) -> Any:
    """Drop what this build's schema does not define, keeping every field it does.

    `extra = "forbid"` is right for a submitted payload but wrong for reading storage back: a blob
    holding one field from a newer build would otherwise fail validation, and a stored recipe the
    user can no longer read is worse than one missing a field this build cannot render anyway.
    """
    if isinstance(value, list):
        return [_readable(model, item) for item in value]
    if not isinstance(value, dict):
        return value
    readable = {}
    for name, field in model.model_fields.items():
        if name not in value:
            continue
        nested = _nested_model(field.annotation)
        readable[name] = _readable(nested, value[name]) if nested else value[name]
    return readable


def _without_field_at_location(value: Any, location: tuple[Any, ...]) -> tuple[Any, bool]:
    """Return a copy with one invalid leaf removed from a nested model payload."""
    if not location:
        return value, False
    key, *rest = location
    if not isinstance(value, dict) or key not in value:
        return value, False
    result = dict(value)
    if not rest:
        result.pop(key)
        return result, True
    nested, removed = _without_field_at_location(result[key], tuple(rest))
    if removed:
        result[key] = nested
    return result, removed


def _validated_without_invalid_fields(
    schema: type[BaseModel], payload: dict
) -> tuple[BaseModel, list[tuple[Any, ...]]]:
    """Validate, dropping only the fields that fail.

    Resetting the whole recipe over one unreadable field would hand the client schema defaults,
    which it then autosaves over the rest of a perfectly good stored recipe.
    """
    remaining = payload
    removed_locations = []
    while True:
        try:
            return schema.model_validate(remaining), removed_locations
        except ValidationError as exc:
            for error in exc.errors():
                location = tuple(error.get("loc", ()))
                remaining, removed = _without_field_at_location(remaining, location)
                if removed:
                    removed_locations.append(location)
                    break
            else:
                return schema(), removed_locations


_MISSING = object()


def _value_at_location(value: Any, location: tuple[Any, ...]) -> Any:
    for key in location:
        if not isinstance(value, dict) or key not in value:
            return _MISSING
        value = value[key]
    return value


def _with_value_at_location(
    value: Any, location: tuple[Any, ...], replacement: Any
) -> tuple[Any, bool]:
    if not location:
        return replacement, True
    key, *rest = location
    if not isinstance(value, dict) or key not in value:
        return value, False
    result = dict(value)
    nested, replaced = _with_value_at_location(result[key], tuple(rest), replacement)
    if replaced:
        result[key] = nested
    return result, replaced


def _preserve_recovered_defaults(schema: type[BaseModel], stored: dict, submitted: dict) -> dict:
    """Do not mistake a recovery default for an edit to an unreadable stored field.

    A downgraded GET omits known fields whose values this schema cannot validate, then Pydantic
    supplies their defaults in the response. The client cannot tell those defaults from stored
    values and echoes them in its next state write. Preserve the raw leaf only while the submitted
    value is still the synthesized value; a real edit remains authoritative.
    """
    recovered, locations = _validated_without_invalid_fields(schema, _readable(schema, stored))
    recovered_values = recovered.model_dump()
    merged = submitted
    for location in locations:
        previous = _value_at_location(stored, location)
        submitted_value = _value_at_location(submitted, location)
        recovered_value = _value_at_location(recovered_values, location)
        if (
            previous is not _MISSING
            and submitted_value is not _MISSING
            and recovered_value is not _MISSING
            and submitted_value == recovered_value
        ):
            merged, _ = _with_value_at_location(merged, location, previous)
    return merged


def _validated_readable_model(schema: type[BaseModel], payload: Any) -> Optional[BaseModel]:
    try:
        return schema.model_validate(_readable(schema, payload))
    except ValidationError:
        return None


def _get_generation_preset_settings(kind, schema):
    stored = get_media_generation_preset_settings(kind)
    try:
        response = schema.model_validate(_readable(schema, stored))
    except ValidationError:
        # A value this build cannot represent at all. Drop only what fails: one unreadable entry
        # costs neither the rest of the list nor the state, which is validated on its own here.
        logger.warning("Dropping unreadable %s generation preset entries", kind)
        presets = schema.model_fields["customPresets"].annotation
        item = _nested_model(get_args(presets)[0] if get_args(presets) else presets)
        readable = []
        # Only a list is a preset collection. Recovery exists so a store this build cannot
        # represent still reads; iterating a scalar here would answer 500 instead, which is the
        # one outcome it is meant to prevent. _custom_presets takes the same view on the write.
        raw_presets = stored.get("customPresets")
        for raw in raw_presets if isinstance(raw_presets, list) else []:
            validated = _validated_readable_model(item, raw)
            if validated is not None:
                readable.append(validated)
        state = {
            key: value for key, value in _readable(schema, stored).items() if key != "customPresets"
        }
        response, _ = _validated_without_invalid_fields(
            schema, {**state, "customPresets": readable}
        )
    # Saved means the store owns the CURRENT recipe, not merely that something is stored. A blob
    # holding named presets but no recipe -- a preset write that landed while the state write did
    # not -- would otherwise hand back schema defaults dressed as the user's own choice, and the
    # client suppresses the resident model's defaults for exactly as long as it believes that.
    response.saved = isinstance(stored.get("currentParams"), dict)
    return response


@router.get(
    "/generation-presets/image",
    response_model = ImageGenerationPresetSettings,
)
def get_image_generation_preset_settings(
    current_subject: str = Depends(get_current_subject),
) -> ImageGenerationPresetSettings:
    return _get_generation_preset_settings("image", ImageGenerationPresetSettings)


@router.put("/generation-presets/image")
def update_image_generation_preset_settings(
    payload: ImageGenerationPresetState, current_subject: str = Depends(get_current_subject)
) -> dict[str, bool]:
    set_media_generation_preset_settings(
        "image",
        payload.model_dump(),
        lambda stored, submitted: _preserve_recovered_defaults(
            ImageGenerationPresetState, stored, submitted
        ),
    )
    return {"saved": True}


@router.get(
    "/generation-presets/video",
    response_model = VideoGenerationPresetSettings,
)
def get_video_generation_preset_settings(
    current_subject: str = Depends(get_current_subject),
) -> VideoGenerationPresetSettings:
    return _get_generation_preset_settings("video", VideoGenerationPresetSettings)


@router.put("/generation-presets/video")
def update_video_generation_preset_settings(
    payload: VideoGenerationPresetState, current_subject: str = Depends(get_current_subject)
) -> dict[str, bool]:
    set_media_generation_preset_settings(
        "video",
        payload.model_dump(),
        lambda stored, submitted: _preserve_recovered_defaults(
            VideoGenerationPresetState, stored, submitted
        ),
    )
    return {"saved": True}


def _upsert_custom_generation_preset(
    kind: Literal["image", "video"], payload: ImageGenerationPreset | VideoGenerationPreset
) -> dict[str, bool]:
    try:
        schema = type(payload)
        upsert_media_generation_preset(
            kind,
            payload.model_dump(),
            lambda stored: _validated_readable_model(schema, stored) is not None,
        )
    except ValueError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    return {"saved": True}


@router.put("/generation-presets/image/custom")
def upsert_custom_image_generation_preset(
    payload: ImageGenerationPreset, current_subject: str = Depends(get_current_subject)
) -> dict[str, bool]:
    return _upsert_custom_generation_preset("image", payload)


@router.put("/generation-presets/video/custom")
def upsert_custom_video_generation_preset(
    payload: VideoGenerationPreset, current_subject: str = Depends(get_current_subject)
) -> dict[str, bool]:
    return _upsert_custom_generation_preset("video", payload)


@router.delete("/generation-presets/{kind}/custom")
def delete_custom_generation_preset(
    kind: Literal["image", "video"],
    name: str,
    current_subject: str = Depends(get_current_subject),
) -> dict[str, bool]:
    name = name.strip()
    if not name or name == "Default" or len(name) > 80:
        raise HTTPException(status_code = 422, detail = "Invalid preset name")
    delete_media_generation_preset(kind, name)
    return {"deleted": True}

