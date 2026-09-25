"""Regression checks for the lightweight API-only distribution.

These tests intentionally use only the standard library so CI can run them
without Torch, Transformers, Hugging Face, or a local model runtime.
"""

from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parents[1]


def test_active_requirements_exclude_local_ml_stack():
    requirements = (BACKEND / "requirements" / "studio.txt").read_text(encoding="utf-8").lower()
    for retired_dependency in (
        "torch",
        "transformers",
        "huggingface",
        "unsloth",
        "sentence-transformers",
        "sqlite-vec",
        "whisper",
    ):
        assert retired_dependency not in requirements
    assert "fastapi" in requirements
    assert "httpx" in requirements


def test_openai_chat_route_refuses_local_execution():
    inference = (BACKEND / "routes" / "inference.py").read_text(encoding="utf-8")
    rejection = inference.index("Local model execution has been removed")
    assert rejection >= 0
    assert inference.find("get_llama_cpp_backend", rejection) > rejection


def test_packager_excludes_retired_runtime_components():
    builder = (REPO / "electron-builder.config.cjs").read_text(encoding="utf-8")
    for excluded_path in (
        "vendor/unsloth-installers",
        "install_whisper_prebuilt.py",
        "routes/rag_pkg/**",
        "routes/export.py",
        "core/training/**",
    ):
        assert excluded_path in builder
