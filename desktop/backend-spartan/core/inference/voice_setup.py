"""Shared installation of the CPU Whisper runtime and multilingual base model."""
import subprocess
import logging
import os
import sys
import threading
import time
from pathlib import Path

_lock = threading.Lock()
_state = {'installing': False, 'setup_failed': False, 'failure_code': None}
# Standalone CPU release: later slim bundles require a paired llama runtime.
# Keep voice installation independent from existing chat model runtimes.
CPU_RELEASE = 'v1.9.1-unsloth.1'
logger = logging.getLogger(__name__)
_verified_binary = None


def runtime_verified():
    from core.inference import stt_ggml_sidecar as cpp
    binary = cpp.find_whisper_server_binary()
    try:
        stamp = (binary, Path(binary).stat().st_mtime_ns)
    except (OSError, TypeError):
        return False
    return _verified_binary == stamp


def probe_runtime(cpp):
    global _verified_binary
    _verified_binary = None
    binary = cpp.find_whisper_server_binary()
    if not binary:
        raise RuntimeError('voice_runtime_unavailable')
    try:
        probe = subprocess.run([binary, '--help'], capture_output=True, timeout=15,
                               env=cpp._whisper_server_child_env(binary),
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        code = probe.returncode & 0xffffffff
    except (OSError, subprocess.TimeoutExpired):
        code = None
    if code != 0:
        reason = 'voice_runtime_blocked' if code == 0xC0E90002 else 'voice_runtime_launch_failed'
        cpp.note_runtime_inference_failure(reason)
        raise RuntimeError(reason)
    cpp.clear_runtime_inference_failure()
    try:
        _verified_binary = (binary, Path(binary).stat().st_mtime_ns)
    except OSError:
        pass


def status():
    with _lock:
        return dict(_state)


def configure(progress=print):
    from core.inference import stt_ggml_sidecar as cpp
    if not cpp.is_available() and cpp.runtime_inference_failure() not in ('voice_runtime_blocked', 'voice_runtime_launch_failed'):
        progress('Instalando motor de voz local Whisper (CPU)...')
        installer = Path(__file__).resolve().parents[2] / 'vendor' / 'unsloth-installers' / 'install_whisper_prebuilt.py'
        environment = dict(os.environ)
        environment['PYTHONPATH'] = str(installer.parents[2]) + os.pathsep + environment.get('PYTHONPATH', '')
        subprocess.run([sys.executable, str(installer), '--install-dir', str(cpp._managed_whisper_cpp_dir()),
                        '--cpu-fallback', '--backend', 'cpu', '--whisper-tag', 'v1.9.1',
                        '--published-release-tag', CPU_RELEASE],
                       check=True, timeout=600, env=environment, capture_output=True,
                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        cpp.clear_runtime_inference_failure()
        if not cpp.is_available():
            raise RuntimeError('voice_runtime_unavailable')
    probe_runtime(cpp)
    if cpp._cached_model_path('base') is None:
        progress('Preparando Whisper base multilingüe...')
        if not cpp.download_status().get('downloading'):
            cpp.start_model_download('base')
        deadline = time.monotonic() + 900
        while cpp.download_status().get('downloading'):
            if time.monotonic() >= deadline:
                raise RuntimeError('voice_model_timeout')
            time.sleep(0.5)
        if cpp._cached_model_path('base') is None:
            raise RuntimeError('voice_model_unavailable')
    progress('Voz local preparada: Whisper base, español e inglés.')


def start():
    with _lock:
        if _state['installing']:
            return
        _state.update(installing=True, setup_failed=False, failure_code=None)
    def worker():
        try:
            configure(lambda _: None)
        except Exception as error:
            with _lock:
                _state['setup_failed'] = True
                _state['failure_code'] = ('runtime_incompatible' if isinstance(error, subprocess.CalledProcessError) and error.returncode == 2
                                          else 'runtime_blocked' if str(error) == 'voice_runtime_blocked'
                                          else 'runtime_launch_failed' if str(error) == 'voice_runtime_launch_failed' else 'setup_failed')
                logger.warning('Voice setup failed: %s', _state['failure_code'])
        finally:
            with _lock:
                _state['installing'] = False
    threading.Thread(target=worker, name='sparta-voice-setup', daemon=True).start()
