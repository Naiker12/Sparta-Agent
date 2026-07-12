"""
Command subpackage for Sparta CLI.

Each module in this package defines one or more Command instances.
New commands are registered in the registry via the register_commands() helpers.
"""

from sparta_ai.cli.commands.registry import CommandRegistry
from sparta_ai.cli.commands.base import Command

from sparta_ai.cli.commands.core import register_core_commands
from sparta_ai.cli.commands.model import register_model_command
from sparta_ai.cli.commands.provider import register_provider_command

__all__ = [
    "CommandRegistry",
    "Command",
    "register_core_commands",
    "register_model_command",
    "register_provider_command",
]


def build_registry() -> CommandRegistry:
    """Construct the full command registry with all built-in commands."""
    registry = CommandRegistry()
    register_core_commands(registry)
    register_model_command(registry)
    register_provider_command(registry)
    return registry