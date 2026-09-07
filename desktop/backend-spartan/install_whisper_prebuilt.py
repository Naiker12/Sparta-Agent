"""Packaged entry point for the pinned whisper.cpp installer."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).parent / "vendor" / "unsloth-installers" / "install_whisper_prebuilt.py"), run_name="__main__")
