"""Browser regression server: only operates in its own temporary project."""
import json
from pathlib import Path
import socket
import tempfile

from fastapi import FastAPI
import uvicorn

from core.inference.turn_changes import TurnChanges
from routes.chat import router_workspaces as routes


def run():
    with tempfile.TemporaryDirectory(prefix="sparta-turn-changes-") as directory:
        root = Path(directory) / "project"
        root.mkdir()
        store = TurnChanges(Path(directory) / "journal" / "changes.db", require_provenance=True)
        info = root.stat()
        binding = {"canonicalPath": str(root), "filesystemIdentity": f"{info.st_dev}:{info.st_ino}", "access": "write"}
        routes.get_chat_thread = lambda thread: {"id": thread} if thread == "fixture" else None
        routes.get_thread_workspace_binding = lambda thread: binding
        routes._change_store = lambda: store
        app = FastAPI()
        app.include_router(routes.router, prefix="/api/chat")
        app.dependency_overrides[routes.get_current_subject] = lambda: "fixture"

        def capture():
            (root / "app.js").write_text("export const value = 1;\n", encoding="utf-8")
            (root / "notes.txt").write_text("original note\n", encoding="utf-8")
            (root / "index.html").unlink(missing_ok=True)
            ref = store.begin("fixture", "fixture", root)
            with store.record_paths(root, ["app.js", "index.html", "notes.txt"]):
                (root / "app.js").write_text("export const value = 2;\n", encoding="utf-8")
                (root / "index.html").write_text("<!doctype html>\n<h1>Project</h1>\n<p>Ready</p>\n", encoding="utf-8")
                (root / "notes.txt").unlink()
            store.finish("fixture", "fixture", ref["id"], root)
            return ref

        @app.post("/fixture/capture")
        def new_capture(): return capture()

        @app.post("/fixture/unverified-capture")
        def unverified_capture():
            ref = store.begin("fixture", "fixture", root)
            (root / "external.txt").write_text("written outside file tools\n", encoding="utf-8")
            store.finish("fixture", "fixture", ref["id"], root)
            return ref

        @app.post("/fixture/later-edit")
        def edit():
            (root / "app.js").write_text("external edit\n", encoding="utf-8")
            return {"ok": True}

        @app.get("/fixture/state")
        def state(): return {file.name: file.read_text(encoding="utf-8") for file in root.iterdir() if file.is_file()}

        ref = capture()
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        print("TURN_CHANGES_FIXTURE:" + json.dumps({"url": f"http://127.0.0.1:{port}", **ref}), flush=True)
        try:
            uvicorn.Server(uvicorn.Config(app, log_level="error")).run(sockets=[sock])
        finally:
            sock.close()


if __name__ == "__main__": run()
