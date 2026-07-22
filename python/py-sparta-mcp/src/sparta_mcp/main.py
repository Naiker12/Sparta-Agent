import argparse
import io
import json
import logging
import os
import signal
import sys

from sparta_mcp.server import StdioServer

# Forzar UTF-8 en stdin/stdout/stderr para evitar caracteres de reemplazo (�)
# cuando el locale por defecto de Windows no es UTF-8.
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="", line_buffering=True)
except Exception:
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        sys.stdout = os.fdopen(sys.stdout.fileno(), "w", encoding="utf-8", buffering=1)

try:
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", newline="", line_buffering=True)
except Exception:
    try:
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        sys.stderr = os.fdopen(sys.stderr.fileno(), "w", encoding="utf-8", buffering=1)

try:
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", newline="")
except Exception:
    try:
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        sys.stdin = os.fdopen(sys.stdin.fileno(), "r", encoding="utf-8", buffering=1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("sparta_ai")


def _emit_ready():
    """Emit the ready handshake message so Electron knows imports finished."""
    sys.stdout.write(json.dumps({"id": None, "event": "ready", "data": {"pid": os.getpid()}}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description="Sparta AI Sidecar")
    parser.add_argument(
        "--mcp-server",
        action="store_true",
        help="Run as an MCP server (stdio) exposing curated Sparta tools to external clients.",
    )
    args = parser.parse_args()

    if args.mcp_server:
        logger.info("Starting Sparta MCP Server mode")
        import asyncio

        from sparta_mcp.mcp_server.server import run_stdio_server
        asyncio.run(run_stdio_server())
        return

    logger.info("Starting Sparta AI Sidecar (Python + LangGraph)")

    server = StdioServer()

    def shutdown(signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Signal Electron that imports are done and stdin/stdout are ready.
    _emit_ready()

    try:
        server.run()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        logger.info("Sparta AI Sidecar stopped")


if __name__ == "__main__":
    main()
