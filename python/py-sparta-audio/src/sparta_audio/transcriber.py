"""Local Whisper transcription via faster-whisper.

Model is loaded lazily on first call and cached for the process lifetime.
Model "base" (~145 MB) offers good accuracy/speed trade-off on CPU.
"""
import logging
import os
from functools import lru_cache

logger = logging.getLogger("sparta_ai.audio.transcriber")

_MODEL_NAME = os.environ.get("SPARTA_WHISPER_MODEL", "base")


@lru_cache(maxsize=1)
def _get_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise ImportError(
            "faster-whisper is not installed. "
            "Install it with: pip install -e '.[audio]'"
        )
    logger.info("Loading Whisper model '%s' (first-time download may take a moment)...", _MODEL_NAME)
    model = WhisperModel(_MODEL_NAME, device="cpu", compute_type="int8")
    logger.info("Whisper model '%s' loaded.", _MODEL_NAME)
    return model


def transcribe(audio_path: str, language: str | None = "es") -> str:
    """Transcribe an audio file and return the recognized text.

    Args:
        audio_path: Path to a supported audio file (webm, wav, mp3, etc.).
        language: ISO 639-1 language code, or None for auto-detect.

    Returns:
        Transcribed text, or empty string if nothing recognized.
    """
    model = _get_model()
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=1,
        vad_filter=True,
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    logger.info(
        "Transcribed %s → %d chars (lang=%s, prob=%.2f)",
        audio_path, len(text), info.language, info.language_probability,
    )
    return text
