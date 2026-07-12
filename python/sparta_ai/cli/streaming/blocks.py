"""
Helpers for extracting text from LangGraph streaming blocks.

Extracted from the original _block_text function in cli.py.
"""


def block_text(block: dict) -> str:
    """Extract text content from a streaming block dict."""
    if isinstance(block, dict):
        if block.get("type") == "text":
            return block.get("text", "")
        if block.get("type") in ("thinking", "reasoning"):
            return block.get("text") or block.get("thinking", "") or block.get("reasoning", "") or ""
        if "text" in block:
            return str(block["text"])
    return ""