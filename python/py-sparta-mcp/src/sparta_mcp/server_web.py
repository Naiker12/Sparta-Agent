import asyncio
import json
import os
import logging

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

logger = logging.getLogger("sparta_ai.server_web")

SPARTA_WS_TOKEN = os.environ.get("SPARTA_WS_TOKEN")

ALLOWED_ORIGINS = frozenset({
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
})

app = FastAPI(title="Sparta AI Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

connections: dict[str, WebSocket] = {}


@app.on_event("shutdown")
async def _shutdown_mcp():
    from sparta_tools.mcp_manager import mcp_manager
    await mcp_manager.disconnect_all()


def _check_origin(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin") or websocket.headers.get("sec-websocket-origin", "")
    if not origin:
        return False
    return origin in ALLOWED_ORIGINS


def _check_ws_token(websocket: WebSocket) -> bool:
    if not SPARTA_WS_TOKEN:
        return False
    return websocket.headers.get("x-sparta-token") == SPARTA_WS_TOKEN


async def _require_auth_frame(websocket: WebSocket) -> bool:
    if not SPARTA_WS_TOKEN:
        return False
    try:
        data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        msg = json.loads(data)
        return msg.get("type") == "auth" and msg.get("token") == SPARTA_WS_TOKEN
    except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
        return False


from sparta_mcp.web_routes import register_routes
from sparta_mcp.web_ws import register_ws
from sparta_mcp.web_terminal import register_terminal_ws

register_routes(app)
register_ws(app, check_origin=_check_origin, check_ws_token=_check_ws_token, require_auth_frame=_require_auth_frame, connections=connections)
register_terminal_ws(app, check_origin=_check_origin, check_ws_token=_check_ws_token, require_auth_frame=_require_auth_frame)


def start_web_server(host: str = "127.0.0.1", port: int = 8765):
    if not SPARTA_WS_TOKEN:
        logger.warning(
            "SPARTA_WS_TOKEN is not set; the terminal WebSocket endpoint will reject "
            "all connections. Set the environment variable before starting the server."
        )
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    start_web_server()
