import ast
import asyncio
import os
from pathlib import Path
import types

from utils import torch_warmup


def test_api_only_does_not_start_ml_warm(monkeypatch):
    monkeypatch.setenv('UNSLOTH_API_ONLY', '1')
    monkeypatch.delenv(torch_warmup.DISABLE_ENV_VAR, raising=False)
    monkeypatch.setattr(torch_warmup.threading, 'Thread', lambda **kwargs: (_ for _ in ()).throw(AssertionError('ML thread created')))
    assert torch_warmup.start_background_warm() is False


def test_health_and_post_warm_stay_cold_in_api_mode(monkeypatch):
    monkeypatch.setenv('UNSLOTH_API_ONLY', '1')
    # Compile actual helpers without importing the whole server/optional stack.
    tree = ast.parse((Path(__file__).resolve().parents[1] / 'main.py').read_text(encoding='utf-8'))
    names = {'_start_post_warm_thread', '_await_hardware_detection', '_hardware_snapshot'}
    functions = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in names]
    namespace = {'os': os}
    for function in functions:
        function.returns = None
        for argument in function.args.args:
            argument.annotation = None
    exec(compile(ast.Module(body=functions, type_ignores=[]), 'main-cold-start', 'exec'), namespace)
    # No hardware/thread globals are supplied: touching them would fail the test.
    assert namespace['_start_post_warm_thread']() is False
    assert asyncio.run(namespace['_await_hardware_detection'](1)) is False
    assert namespace['_hardware_snapshot']() == (True, None, None)
