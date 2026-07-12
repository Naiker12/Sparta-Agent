"""
Streaming subpackage for Sparta CLI.
"""

from sparta_ai.cli.streaming.renderer import StreamRenderer
from sparta_ai.cli.streaming.blocks import block_text

__all__ = ["StreamRenderer", "block_text"]