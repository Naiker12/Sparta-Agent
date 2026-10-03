import json

from utils import studio_version


def test_source_manifest_takes_precedence(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    (backend / "utils").mkdir(parents=True)
    monkeypatch.setattr(studio_version, "__file__", str(backend / "utils" / "studio_version.py"))
    (backend / "package.json").write_text(json.dumps({"version": "0.3.2"}), encoding="utf-8")
    (tmp_path / "package.json").write_text(json.dumps({"version": "0.3.3"}), encoding="utf-8")
    assert studio_version.get_studio_version(tmp_path) == "v0.3.3"


def test_packaged_backend_uses_own_manifest(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    (backend / "utils").mkdir(parents=True)
    monkeypatch.setattr(studio_version, "__file__", str(backend / "utils" / "studio_version.py"))
    (backend / "package.json").write_text(json.dumps({"version": "0.3.3"}), encoding="utf-8")
    assert studio_version.get_studio_version(tmp_path / "missing") == "v0.3.3"


def test_invalid_or_absent_versions_report_dev(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    (backend / "utils").mkdir(parents=True)
    monkeypatch.setattr(studio_version, "__file__", str(backend / "utils" / "studio_version.py"))
    (tmp_path / "package.json").write_text(json.dumps({"version": "0.3.3-dirty"}), encoding="utf-8")
    assert studio_version.get_studio_version(tmp_path) == "dev"
    (tmp_path / "package.json").write_text("invalid-json", encoding="utf-8")
    assert studio_version.get_studio_version(tmp_path) == "dev"
