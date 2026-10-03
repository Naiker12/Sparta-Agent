
'Version-safe fp-dtype kwarg for transformers/sentence-transformers loads.\n\ntransformers renamed the ``torch_dtype`` kwarg to ``dtype`` in 4.56.0, and emits\n``torch_dtype is deprecated! Use dtype instead!`` when the old name is passed. But our floor (``transformers>=4.51.3``) predates ``dtype`` and only\naccepts ``torch_dtype``, so a bare rename would ``TypeError`` on the floor. Pick\nthe name the installed version accepts instead.\n\nit independently, for two reasons. It uses a ``packaging.version`` check rather\nthan that constant\'s ``"torch_dtype" in PretrainedConfig.__doc__`` sniffing, which\nraises ``TypeError`` under ``python -OO`` / ``PYTHONOPTIMIZE=2`` (docstrings are\nstripped to ``None``, and ``"torch_dtype" in None`` is a type error). And it avoids\nimporting the constant at all: the RAG\nembedder warms here at startup in the lean main process, and reading it would run\npatching banner) as a side effect. The embedder is deliberately torch-optional (it\ndegrades to the ``llama-server`` GGUF backend), so it must not drag in that\nheavyweight import just to read one bool.'

from functools import lru_cache


@lru_cache(maxsize = 1)
def _has_torch_dtype_kwarg() -> bool:
    """True if the installed transformers still expects the legacy ``torch_dtype``
    name (i.e. predates the ``dtype`` rename). False when ``dtype`` is the accepted
    name, or when transformers is missing/broken (prefer the modern name)."""
    try:
        import transformers
        from packaging.version import Version

        # Compare on the release tuple so a pre-release of the rename version
        # (``4.56.0.dev0``/``rc1``, which sort *below* ``4.56.0``) still counts as
        # new and picks ``dtype`` -- those builds already accept it, and picking
        # ``torch_dtype`` there would re-emit the very warning this suppresses.
        return Version(transformers.__version__).release < (4, 56, 0)
    except Exception:
        return False


def dtype_kwargs(value) -> dict:
    """``{"torch_dtype": value}`` on old transformers, ``{"dtype": value}`` on new.

    Splat into a load call (``pipeline(..., **dtype_kwargs(torch.float16))``) or use
    directly as ``model_kwargs`` (``model_kwargs = dtype_kwargs("float16")``).
    """
    return {"torch_dtype" if _has_torch_dtype_kwarg() else "dtype": value}
