"""Shared voice availability and setup; independent of transport and chat UI."""
import importlib.util

MODEL = "base"
MAX_BYTES = 20 * 1024 * 1024
MAX_SECONDS = 300

def status():
    from core.inference.voice_setup import status as setup_status, runtime_verified
    progress = {**setup_status(), 'downloading': False, 'bytes_done': None, 'bytes_total': None, 'download_failed': False}
    try:
        from core.inference import stt_ggml_sidecar, stt_sidecar
        for module in (stt_ggml_sidecar, stt_sidecar):
            download = module.download_status()
            if download.get('requested_model') == MODEL and download.get('error'):
                progress['download_failed'] = True
            if download.get('downloading') and download.get('model') == MODEL:
                progress.update(downloading=True, bytes_done=download.get('bytes_done'), bytes_total=download.get('bytes_total'))
        cpp = stt_ggml_sidecar.is_available()
        if cpp and runtime_verified() and stt_ggml_sidecar._cached_model_path(MODEL) is not None:
            return {**progress, 'ready': True, 'model': MODEL, 'engine': 'gguf', 'reason': None}
        downloaded = stt_sidecar.is_model_downloaded(MODEL)
        available = stt_sidecar.is_available() if downloaded else all(importlib.util.find_spec(name) for name in ('torch', 'transformers', 'av'))
        if available and downloaded:
            return {**progress, 'ready': True, 'model': MODEL, 'engine': 'transformers', 'reason': None}
        return {**progress, 'ready': False, 'model': MODEL, 'engine': None, 'reason': 'needs_model' if cpp or available else 'needs_runtime'}
    except Exception:
        return {**progress, 'ready': False, 'model': MODEL, 'engine': None, 'reason': 'unavailable'}


def prepare(status_reader=None):
    read_status = status_reader or status
    from core.inference import stt_ggml_sidecar, stt_sidecar
    current = read_status()
    if current['ready'] or current['downloading'] or current.get('installing'):
        return current
    if stt_ggml_sidecar.is_available() or stt_ggml_sidecar.runtime_inference_failure() in ('voice_runtime_blocked', 'voice_runtime_launch_failed'):
        from core.inference.voice_setup import start
        start()
        return read_status()
    elif stt_sidecar.is_available():
        module = stt_sidecar
    else:
        from core.inference.voice_setup import start
        start()
        return read_status()
    try:
        # Existing verified cache/downloader; never a download URL from a chat.
        module.start_model_download(MODEL)
    except Exception:
        raise ValueError('voice_busy') from None
    return read_status()


def active_status(status_reader=None):
    from core.inference.voice_providers import read, CATALOG
    config = read()
    provider = config['provider']
    if provider == 'local':
        return {**(status_reader or status)(), 'provider': 'local', 'provider_name': 'Whisper'}
    profile = config['profiles'].get(provider, {})
    return {'ready': bool(profile.get('key')), 'model': profile.get('model', ''),
            'engine': 'remote', 'reason': None if profile.get('key') else 'needs_configuration',
            'provider': provider, 'provider_name': CATALOG[provider]['name']}


