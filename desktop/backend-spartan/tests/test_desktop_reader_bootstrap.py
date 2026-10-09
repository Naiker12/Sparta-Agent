import importlib.util
import runpy

import pytest

import desktop_bootstrap


def test_missing_reader_fails_before_ready_handshake(monkeypatch, capsys):
    monkeypatch.setattr(importlib.util, 'find_spec', lambda name: None if name == 'openpyxl' else object())
    monkeypatch.setattr(runpy, 'run_path', lambda *args, **kwargs: pytest.fail('Server started without readers'))
    with pytest.raises(RuntimeError, match='Faltan lectores de documentos: openpyxl'):
        desktop_bootstrap.main()
    assert 'SPARTA_DESKTOP_SECRET=' not in capsys.readouterr().out


def test_reader_probe_starts_backend_without_importing_readers(monkeypatch, capsys):
    from auth import storage
    checked = []
    started = []
    monkeypatch.setattr(importlib.util, 'find_spec', lambda name: checked.append(name) or object())
    monkeypatch.setattr(storage, 'create_desktop_secret', lambda: 'fixture-secret')
    monkeypatch.setattr(runpy, 'run_path', lambda entrypoint, **kwargs: started.append((entrypoint, kwargs)))
    monkeypatch.setattr(desktop_bootstrap.sys, 'argv', ['desktop_bootstrap.py'])
    desktop_bootstrap.main()
    assert checked == ['pymupdf', 'docx', 'openpyxl']
    assert len(started) == 1
    assert started[0][1] == {'run_name': '__main__'}
    assert capsys.readouterr().out == 'SPARTA_DESKTOP_SECRET=fixture-secret\n'
