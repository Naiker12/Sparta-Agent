from pathlib import Path
from unittest.mock import Mock

import pytest
from core.inference import voice_setup, stt_ggml_sidecar as cpp


@pytest.fixture(autouse=True)
def clean_runtime(monkeypatch):
    monkeypatch.setattr(cpp, "_runtime_inference_failure", None)
    monkeypatch.setattr(cpp, "find_whisper_server_binary", lambda: "whisper-server")
    monkeypatch.setattr(cpp, "_whisper_server_child_env", lambda _: {})
    monkeypatch.setattr(voice_setup.subprocess, "run", Mock(return_value=Mock(returncode=0)))


def test_ready_setup_probes_without_installing_or_downloading(monkeypatch):
    monkeypatch.setattr(cpp, 'is_available', lambda: True)
    monkeypatch.setattr(cpp, '_cached_model_path', lambda _: Path('cached.bin'))
    install = Mock(return_value=Mock(returncode=0))
    download = Mock()
    monkeypatch.setattr(voice_setup.subprocess, 'run', install)
    monkeypatch.setattr(cpp, 'start_model_download', download)
    voice_setup.configure(lambda _: None)
    assert install.call_args.args[0] == ['whisper-server', '--help']
    download.assert_not_called()


def test_runtime_uses_existing_verified_installer_and_cpu(monkeypatch, tmp_path):
    from types import SimpleNamespace
    checks = iter([False, True])
    monkeypatch.setattr(cpp, 'is_available', lambda: next(checks))
    monkeypatch.setattr(cpp, '_managed_whisper_cpp_dir', lambda: tmp_path)
    monkeypatch.setattr(cpp, '_cached_model_path', lambda _: Path('cached.bin'))
    install = Mock(return_value=SimpleNamespace(returncode=0))
    monkeypatch.setattr(cpp, 'find_whisper_server_binary', lambda: 'whisper-server')
    monkeypatch.setattr(cpp, '_whisper_server_child_env', lambda _: {})
    monkeypatch.setattr(voice_setup.subprocess, 'run', install)
    voice_setup.configure(lambda _: None)
    args = install.call_args_list[0].args[0]
    assert '--cpu-fallback' in args
    assert args[args.index('--published-release-tag') + 1] == voice_setup.CPU_RELEASE
    assert args[args.index('--backend') + 1] == 'cpu'
    assert str(tmp_path) in args
    assert install.call_args_list[0].kwargs['check'] is True
    assert 'backend-spartan' in install.call_args_list[0].kwargs['env']['PYTHONPATH']


def test_install_failure_prevents_model_download(monkeypatch):
    monkeypatch.setattr(cpp, 'is_available', lambda: False)
    monkeypatch.setattr(voice_setup.subprocess, 'run', Mock(side_effect=RuntimeError('failure')))
    download = Mock()
    monkeypatch.setattr(cpp, 'start_model_download', download)
    with pytest.raises(RuntimeError):
        voice_setup.configure(lambda _: None)
    download.assert_not_called()


def test_model_download_must_finish_before_success(monkeypatch):
    monkeypatch.setattr(cpp, 'is_available', lambda: True)
    cached = iter([None, Path('cached.bin')])
    monkeypatch.setattr(cpp, '_cached_model_path', lambda _: next(cached))
    monkeypatch.setattr(cpp, 'download_status', lambda: {'downloading': False})
    download = Mock()
    monkeypatch.setattr(cpp, 'start_model_download', download)
    voice_setup.configure(lambda _: None)
    download.assert_called_once_with('base')


def test_background_incompatibility_is_sanitized(monkeypatch):
    import subprocess
    monkeypatch.setattr(voice_setup, '_state', {'installing': False, 'setup_failed': False, 'failure_code': None})
    monkeypatch.setattr(voice_setup, 'configure', Mock(side_effect=subprocess.CalledProcessError(2, 'private command')))
    class ImmediateThread:
        def __init__(self, target, **kwargs):
            self.target = target
        def start(self):
            self.target()
    monkeypatch.setattr(voice_setup.threading, 'Thread', ImmediateThread)
    voice_setup.start()
    assert voice_setup.status() == {'installing': False, 'setup_failed': True, 'failure_code': 'runtime_incompatible'}


def test_downloaded_runtime_must_start_before_downloading_model(monkeypatch, tmp_path):
    from types import SimpleNamespace
    checks = iter([False, True])
    monkeypatch.setattr(cpp, 'is_available', lambda: next(checks))
    monkeypatch.setattr(cpp, '_managed_whisper_cpp_dir', lambda: tmp_path)
    monkeypatch.setattr(cpp, 'find_whisper_server_binary', lambda: 'whisper-server')
    monkeypatch.setattr(cpp, '_whisper_server_child_env', lambda _: {})
    monkeypatch.setattr(voice_setup.subprocess, 'run', Mock(side_effect=[SimpleNamespace(returncode=0), SimpleNamespace(returncode=-1)]))
    note = Mock()
    monkeypatch.setattr(cpp, 'note_runtime_inference_failure', note)
    download = Mock()
    monkeypatch.setattr(cpp, 'start_model_download', download)
    with pytest.raises(RuntimeError, match='voice_runtime_launch_failed'):
        voice_setup.configure(lambda _: None)
    note.assert_called_once_with('voice_runtime_launch_failed')
    download.assert_not_called()


@pytest.mark.parametrize('exit_code', [-1058471934, 0xC0E90002])
def test_policy_block_does_not_download_model_or_reinstall_on_retry(monkeypatch, exit_code):
    monkeypatch.setattr(cpp, 'is_available', lambda: cpp.runtime_inference_failure() is None)
    runner = Mock(return_value=Mock(returncode=exit_code))
    monkeypatch.setattr(voice_setup.subprocess, 'run', runner)
    download = Mock()
    monkeypatch.setattr(cpp, 'start_model_download', download)
    for _ in range(2):
        with pytest.raises(RuntimeError, match='voice_runtime_blocked'):
            voice_setup.configure(lambda _: None)
    assert all(call.args[0] == ['whisper-server', '--help'] for call in runner.call_args_list)
    download.assert_not_called()
