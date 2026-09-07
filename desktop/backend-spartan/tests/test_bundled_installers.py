"""The same entry points must run from source and a packaged resource tree."""
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


@pytest.mark.parametrize("name", ["install_llama_prebuilt.py", "install_whisper_prebuilt.py"])
def test_packaged_installer_runs_outside_backend_working_directory(tmp_path, name):
    source = Path(__file__).resolve().parents[1]
    packaged = tmp_path / "resources" / "backend"
    packaged.mkdir(parents=True)
    shutil.copy2(source / name, packaged / name)
    shutil.copytree(source / "vendor" / "unsloth-installers", packaged / "vendor" / "unsloth-installers")
    (packaged / "utils" / "prebuilt").mkdir(parents=True)
    shutil.copy2(source / "utils" / "prebuilt" / "llama_backend.py", packaged / "utils" / "prebuilt" / "llama_backend.py")
    result = subprocess.run(
        [sys.executable, str(packaged / name), "--help"],
        cwd=tmp_path, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert "--resolve-prebuilt" in result.stdout


def test_updater_discovers_bundled_installers(monkeypatch):
    from utils.prebuilt.update_flow import find_installer_script
    root = Path(__file__).resolve().parents[1]
    for component in ("llama", "whisper"):
        env_var = f"UNSLOTH_{component.upper()}_INSTALLER"
        monkeypatch.delenv(env_var, raising=False)
        name = f"install_{component}_prebuilt.py"
        assert find_installer_script(env_var=env_var, script_name=name) == root / name
