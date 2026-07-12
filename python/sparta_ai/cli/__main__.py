"""
Allow ``python -m sparta_ai.cli`` to launch the REPL.

Usage:
    python -m sparta_ai.cli --help
    python -m sparta_ai.cli --model gpt-4o
"""

import typer
from sparta_ai.cli.app import repl

typer.run(repl)