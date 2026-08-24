import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("SPARTA_DATA_DIR", Path.home() / ".sparta"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("SPARTA_HOST", "127.0.0.1")
PORT = int(os.environ.get("SPARTA_PORT", "8000"))
DEBUG = os.environ.get("SPARTA_DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("SPARTA_SECRET_KEY", "sparta-agent-secure-secret-key-321")
