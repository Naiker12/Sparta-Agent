"""
Sparta CLI — REPL with LangGraph agent via prompt_toolkit + Rich.

⚠ DEPRECATED — This file is a backward-compatibility shim.
The implementation has moved to the ``sparta_ai.cli`` subpackage.

Usage (from the ``python/`` directory):
    python -m sparta_ai.cli --help
    python -m sparta_ai.cli --model gpt-4o
"""

from sparta_ai.cli.app import repl
import typer


def main() -> None:
    typer.run(repl)


if __name__ == "__main__":
    main()