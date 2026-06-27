import sys
import signal
import logging

from sparta_ai.server import StdioServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("sparta_ai")


def main():
    logger.info("Starting Sparta AI Sidecar (Python + LangGraph)")

    server = StdioServer()

    def shutdown(signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        server.run()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        logger.info("Sparta AI Sidecar stopped")


if __name__ == "__main__":
    main()
