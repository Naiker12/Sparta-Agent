"""Multimodal Media & Audio/Video Content Extraction Utilities.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import base64
import io
import logging
import math
import os
import tempfile
import wave
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from utils.paths import ensure_dir

logger = logging.getLogger(__name__)

# Constants for STT audio decoding bounds
STT_AUDIO_B64_MAX_CHARS = 25 * 1024 * 1024
STT_AUDIO_RAW_MAX_BYTES = 20 * 1024 * 1024

def _decode_audio_base64(b64: str) -> "np.ndarray":
    """Decode base64 audio (any format) → float32 numpy array at 16kHz."""
    import torchaudio
    import tempfile
    import os
    from utils.paths import ensure_dir, tmp_root

    raw = base64.b64decode(b64)
    # torchaudio.load needs a path or file-like with a format hint; write a
    # temp file so it can auto-detect the format.
    with tempfile.NamedTemporaryFile(
        suffix = ".audio",
        delete = False,
        dir = str(ensure_dir(tmp_root())),
    ) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name
    try:
        waveform, sr = torchaudio.load(tmp_path)
    finally:
        os.unlink(tmp_path)

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim = 0, keepdim = True)

    if sr != 16000:
        resampler = torchaudio.transforms.Resample(orig_freq = sr, new_freq = 16000)
        waveform = resampler(waveform)

    return waveform.squeeze(0).numpy()


# Reject oversized audio before decoding. base64 inflates raw bytes by ~4/3, so
# cap the encoded length to bound the upload. _MAX_AUDIO_SECONDS additionally
# bounds the *decoded* length, since a small compressed file (opus/flac/etc.)
# can expand to a far larger PCM array than the encoded-size cap implies.
_MAX_AUDIO_RAW_BYTES = STT_AUDIO_RAW_MAX_BYTES
_MAX_AUDIO_B64_CHARS = STT_AUDIO_B64_MAX_CHARS
# The composer's 64 MB cap as padded base64: 4 chars per 3 bytes, rounded up.
# Flooring instead refused a file of exactly the size the composer allows.
_MAX_VIDEO_B64_CHARS = 4 * math.ceil((64 * 1024 * 1024) / 3)
_MAX_AUDIO_SECONDS = 30 * 60
_WAV_HEADER_BYTES = 44
_MIN_TRANSCODE_AUDIO_SAMPLE_RATE = 8000


def _sniff_audio_container(raw: bytes) -> Optional[str]:
    """Return 'wav' or 'mp3' if the bytes are a container llama-server accepts
    directly (so we can forward them untouched), else None (needs transcoding)."""
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
        return "wav"
    # mp3: ID3 tag, or an MPEG audio frame sync (no other accepted format leads
    # with 0xFF, so the simple sync check doesn't collide).
    if raw[:3] == b"ID3" or (len(raw) >= 2 and raw[0] == 0xFF and (raw[1] & 0xE0) == 0xE0):
        return "mp3"
    return None


def _mono_f32_to_wav_bytes(arr: "np.ndarray", sample_rate: int) -> bytes:
    """Encode a mono float32 array as 16-bit PCM WAV bytes.

    Torch-free (numpy + stdlib only) so it works on no-torch GGUF-only installs;
    the shared audio_codecs helper pulls in torch at import time.
    """
    import io
    import numpy as np
    import wave

    arr = np.nan_to_num(np.asarray(arr, dtype = np.float32).flatten(), posinf = 0.0, neginf = 0.0)
    if arr.size == 0:
        raise ValueError("decoded audio is empty")
    peak = float(np.abs(arr).max())
    if peak > 1.0:
        arr = arr / peak
    pcm = (arr * 32767.0).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sample_rate))
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def _resample_mono_linear(arr: "np.ndarray", source_rate: int, target_rate: int) -> "np.ndarray":
    """Small numpy-only resampler for upload size limiting."""
    import numpy as np

    if source_rate <= 0 or target_rate <= 0 or source_rate == target_rate:
        return arr
    duration = len(arr) / float(source_rate)
    target_len = max(1, int(round(duration * target_rate)))
    if target_len == len(arr):
        return arr
    source_x = np.linspace(0.0, duration, num = len(arr), endpoint = False)
    target_x = np.linspace(0.0, duration, num = target_len, endpoint = False)
    return np.interp(target_x, source_x, arr).astype(np.float32)


def _fit_transcoded_audio_to_wav_cap(
    arr: "np.ndarray", sample_rate: int
) -> "tuple[np.ndarray, int]":
    """Downsample only when needed so transcoded WAV stays within the upload cap."""
    if sample_rate <= 0:
        raise ValueError("decoded audio has an invalid sample rate")
    wav_bytes = _WAV_HEADER_BYTES + len(arr) * 2
    if wav_bytes <= _MAX_AUDIO_RAW_BYTES:
        return arr, sample_rate

    duration = len(arr) / float(sample_rate)
    max_samples = max(1, (_MAX_AUDIO_RAW_BYTES - _WAV_HEADER_BYTES) // 2)
    target_rate = int(max_samples // duration)
    if target_rate < _MIN_TRANSCODE_AUDIO_SAMPLE_RATE:
        raise ValueError("decoded audio exceeds the transcoded WAV size limit")
    target_rate = min(sample_rate, target_rate)
    fitted = _resample_mono_linear(arr, sample_rate, target_rate)
    if _WAV_HEADER_BYTES + len(fitted) * 2 > _MAX_AUDIO_RAW_BYTES:
        raise ValueError("decoded audio exceeds the transcoded WAV size limit")
    return fitted, target_rate


def _decode_audio_mono(raw: bytes) -> "tuple[np.ndarray, int]":
    """Decode audio bytes to (mono float32 array, native sample_rate).

    soundfile (libsndfile) reads wav/mp3/ogg/flac straight from memory. librosa
    (ffmpeg-backed) additionally covers m4a/webm but needs a real path and is
    absent on no-torch GGUF-only installs. Both imports are inside the fallback
    so a missing decoder degrades to the next one (and finally a clear error)
    rather than crashing.
    """
    import io

    try:
        import soundfile as sf
        arr, sr = sf.read(io.BytesIO(raw), dtype = "float32")
    except Exception:
        try:
            import librosa
        except ModuleNotFoundError as e:
            raise RuntimeError(
                "this audio format needs librosa, which is not installed in "
                "GGUF-only environments; use wav, mp3, ogg or flac"
            ) from e
        import os
        import tempfile
        from utils.paths import ensure_dir, tmp_root

        with tempfile.NamedTemporaryFile(
            suffix = ".audio",
            delete = False,
            dir = str(ensure_dir(tmp_root())),
        ) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        try:
            arr, sr = librosa.load(tmp_path, sr = None, mono = True)
        finally:
            os.unlink(tmp_path)
    if arr.ndim > 1:
        arr = arr.mean(axis = 1)
    if sr > 0 and len(arr) > sr * _MAX_AUDIO_SECONDS:
        raise ValueError(f"decoded audio exceeds the {_MAX_AUDIO_SECONDS // 60}-minute limit")
    return arr, sr


def _prepare_audio_for_llama(b64: str) -> tuple[str, str]:
    """Return (base64, format) ready for llama-server's input_audio part.

    llama-server's API only accepts wav/mp3, and decodes/resamples/down-mixes
    them itself, so wav and mp3 uploads are forwarded untouched (no decode, no
    PCM payload inflation). Other containers (m4a/ogg/webm/flac) are decoded to
    a mono WAV. Blocking; call via a thread from async paths.
    """
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[1] if "," in b64 else ""
    raw = base64.b64decode(b64)
    passthrough = _sniff_audio_container(raw)
    if passthrough is not None:
        return b64, passthrough

    arr, sr = _decode_audio_mono(raw)
    arr, sr = _fit_transcoded_audio_to_wav_cap(arr, sr)
    return base64.b64encode(_mono_f32_to_wav_bytes(arr, sr)).decode("ascii"), "wav"


def _video_b64_rejection(video_b64: str) -> tuple[str, Optional[tuple[int, str]]]:
    """The clip's base64 without its data URI header, plus why it is refused.

    The header is not payload, so counting it would refuse a clip of exactly the
    size the composer allows. Returned rather than raised so the pre-switch and
    post-load checks share one rule while raising their own way.
    """
    if video_b64.startswith("data:"):
        video_b64 = video_b64.split(",", 1)[1] if "," in video_b64 else ""
    if not video_b64:
        return "", (400, "Could not read the provided video file.")
    if len(video_b64) > _MAX_VIDEO_B64_CHARS:
        return video_b64, (413, "Video file is too large (max 64 MB).")
    return video_b64, None


def _inject_video_part(messages: list[dict], video_b64: str) -> None:
    """Append an input_video part to the last user message, in place.

    llama-server samples the clip into frames itself (ffmpeg via mtmd), so the
    container is forwarded untouched. Rides the message list like image_url and
    input_audio, so it flows through the plain and tool-calling paths alike.
    Ref: llama.cpp tools/server/server-common.cpp, `type == "input_video"`.
    """
    part = {"type": "input_video", "input_video": {"data": video_b64}}
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content")
            if isinstance(content, list):
                content.append(part)
            else:
                msg["content"] = [{"type": "text", "text": content or ""}, part]
            return


def _inject_audio_part(messages: list[dict], audio_b64: str, audio_format: str) -> None:
    """Append an input_audio part to the last user message, in place.

    Audio rides in the message list like image_url parts do, so it flows through
    both the plain and tool-calling generation paths.
    """
    part = {
        "type": "input_audio",
        "input_audio": {"data": audio_b64, "format": audio_format},
    }
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content")
            if isinstance(content, list):
                content.append(part)
            else:
                msg["content"] = [{"type": "text", "text": content or ""}, part]
            return


def _extract_content_parts(messages: list) -> tuple[str, list[dict], "Optional[str]"]:
    """
    Parse OpenAI-format messages into components the inference backend expects.

    Handles both plain-string ``content`` and multimodal content-part arrays
    (``[{type: "text", ...}, {type: "image_url", ...}]``).

    Returns:
        system_prompt:  System message text (empty string if none).
        chat_messages:  Non-system messages with content flattened to strings and
                        assistant reasoning_content preserved.
        image_base64:   Base64 of the *first* image found, or ``None``.
    """
    system_parts: list[str] = []
    chat_messages: list[dict] = []
    first_image_b64: Optional[str] = None

    for msg in messages:
        # ── System / developer messages → extract as system_prompt ────────
        if msg.role in ("system", "developer"):
            if isinstance(msg.content, str):
                system_parts.append(msg.content)
            elif isinstance(msg.content, list):
                # Unlikely but handle: join text parts
                system_parts.append("\n".join(p.text for p in msg.content if p.type == "text"))
            continue

        # ── User / assistant messages ─────────────────────────
        combined_text: Optional[str] = None
        if isinstance(msg.content, str):
            # Plain string content — pass through
            combined_text = msg.content
        elif isinstance(msg.content, list):
            # Multimodal content parts
            text_parts: list[str] = []
            for part in msg.content:
                if part.type == "text":
                    text_parts.append(part.text)
                elif part.type == "image_url" and first_image_b64 is None:
                    url = part.image_url.url
                    if url.startswith("data:"):
                        # data:image/png;base64,<DATA> -> extract <DATA>
                        first_image_b64 = url.split(",", 1)[1] if "," in url else None
                    else:
                        logger.warning(f"Remote image URLs not yet supported: {url[:80]}...")
            combined_text = "\n".join(text_parts) if text_parts else ""
        elif msg.role == "assistant" and msg.reasoning_content:
            # A reasoning-only turn has no visible content, but still needs a
            # message for templates that consume reasoning_content.
            combined_text = ""

        if combined_text is None:
            continue
        chat_message = {"role": msg.role, "content": combined_text}
        if msg.role == "assistant" and msg.reasoning_content:
            chat_message["reasoning_content"] = msg.reasoning_content
        chat_messages.append(chat_message)

    return "\n\n".join(p for p in system_parts if p), chat_messages, first_image_b64


# ── External provider proxy ──────────────────────────────────────


# Providers whose stream helper translates `input_document` parts into a
# native attachment block on the wire. Anthropic: `_stream_anthropic` ->
# {type:"document", source:...}; OpenAI: `_stream_openai_responses` ->
# {type:"input_file", file_data|file_url}. Every other provider (gemini /
# mistral / kimi / openrouter / deepseek / custom OpenAI-compat) goes through
# the generic /chat/completions passthrough that forwards messages verbatim,
# so handing them an `input_document` part would 400 with an unknown
# content_part type.
