"""
Sparta CLI Package — modular REPL with LangGraph agent.

Re-exports the entry point for backward compatibility.
"""

from sparta_ai.cli.app import repl, main

__all__ = ["repl", "main"]