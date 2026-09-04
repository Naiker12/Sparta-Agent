"""Studio Artifact Preview Frame Router.

Extracted from monolithic routes/inference.py to preserve SRP and modularity.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, status
from auth.authentication import get_current_subject

studio_router = APIRouter()
router = studio_router

_ARTIFACT_PREVIEW_FRAME_ANCESTORS = (
    "'self' tauri://localhost http://tauri.localhost http://localhost:* http://127.0.0.1:*"
)
_ARTIFACT_PREVIEW_FRAME_STRICT_CSP = (
    "default-src 'none'; "
    "script-src 'unsafe-inline'; "
    "style-src 'unsafe-inline'; "
    "img-src data: blob:; "
    "font-src data:; "
    "media-src data: blob:; "
    "connect-src 'none'; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'; "
    f"frame-ancestors {_ARTIFACT_PREVIEW_FRAME_ANCESTORS}; "
    "sandbox allow-scripts"
)
_ARTIFACT_PREVIEW_FRAME_NETWORK_CSP = (
    "default-src http: https: data: blob:; "
    "script-src 'unsafe-inline' 'unsafe-eval' http: https: data: blob:; "
    "script-src-elem 'unsafe-inline' http: https: data: blob:; "
    "style-src 'unsafe-inline' http: https: data: blob:; "
    "style-src-elem 'unsafe-inline' http: https: data: blob:; "
    "img-src http: https: data: blob:; "
    "font-src http: https: data: blob:; "
    "media-src http: https: data: blob:; "
    "connect-src http: https: ws: wss: data: blob:; "
    "worker-src http: https: blob:; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'; "
    f"frame-ancestors {_ARTIFACT_PREVIEW_FRAME_ANCESTORS}; "
    "sandbox allow-scripts"
)
_ARTIFACT_PREVIEW_FRAME_HTML = """<!doctype html>
<html>
  <head><meta charset=\"utf-8\" /></head>
  <body>
    <script>
      (() => {
        const createMemoryStorage = () => {
          const data = new Map();
          return {
            get length() { return data.size; },
            key: (index) => Array.from(data.keys())[index] ?? null,
            getItem: (key) => data.has(String(key)) ? data.get(String(key)) : null,
            setItem: (key, value) => data.set(String(key), String(value)),
            removeItem: (key) => data.delete(String(key)),
            clear: () => data.clear(),
          };
        };
        const installStorageFallback = (name) => {
          try {
            void window[name];
            return;
          } catch {
            // Opaque-origin sandboxed frames throw SecurityError for Web Storage.
          }
          try {
            Object.defineProperty(window, name, {
              value: createMemoryStorage(),
              configurable: true,
            });
          } catch {
            // Leave the sandbox failure contained in the canvas if the
            // browser refuses to shadow the Web Storage accessor.
          }
        };
        const installStorageFallbacks = () => {
          installStorageFallback("localStorage");
          installStorageFallback("sessionStorage");
        };
        // randomUUID is unavailable in this opaque HTTP context. The strict CSP
        // forbids crypto-boot.js, so install the same fallback inline.
        const installRandomUUIDFallback = () => {
          if (!window.crypto || typeof crypto.randomUUID === "function") return;
          const randomByte = () => crypto.getRandomValues(new Uint8Array(1))[0];
          crypto.randomUUID = () =>
            "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
              (+c ^ (randomByte() & (15 >> (+c / 4)))).toString(16));
        };
        // Stamp the load this frame was served for. A report still in flight
        // when the canvas is swapped would otherwise be read as the new one's.
        const loadVersion = new URLSearchParams(location.search).get("v") || "";
        const reportBlocked = (event) => {
          parent.postMessage({
            type: "unsloth:artifact-blocked",
            blockedURI: event.blockedURI || "",
            effectiveDirective: event.effectiveDirective || "",
            v: loadVersion,
          }, "*");
        };
        const render = (html) => {
          installStorageFallbacks();
          document.open();
          document.write(html);
          document.close();
          // document.open() drops listeners bound before it, so rebind here.
          document.addEventListener("securitypolicyviolation", reportBlocked, true);
        };
        installStorageFallbacks();
        // Survives the document.open() in render(), so once is enough.
        installRandomUUIDFallback();
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (!data || data.type !== "unsloth:artifact-html" || typeof data.html !== "string") return;
          render(data.html);
        });
      })();
    </script>
  </body>
</html>"""


async def _authenticate_header_or_query(request: Request, token: Optional[str]) -> str:
    """Resolve the bearer token from the Authorization header or the ``?token=``
    query param (needed for <img src> / <iframe>, which can't send custom
    headers), validate it, and return the subject. Raises 401 when absent."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        jwt_token = auth_header[7:]
    elif token:
        jwt_token = token
    else:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Missing authentication token",
        )
    from fastapi.security import HTTPAuthorizationCredentials

    creds = HTTPAuthorizationCredentials(scheme = "Bearer", credentials = jwt_token)
    return await get_current_subject(creds)


@studio_router.get("/artifact-preview-frame", include_in_schema = False)
async def artifact_preview_frame(allow_network: bool = False):
    """Serve the opaque sandbox shell for client-side HTML canvases.

    No auth token by design: the URL is readable by the untrusted canvas via
    location.href, and this static shell exposes no server resource (frame-ancestors
    plus the sandbox already gate it), so the CSP is chosen from allow_network alone.
    """

    csp = (
        _ARTIFACT_PREVIEW_FRAME_NETWORK_CSP if allow_network else _ARTIFACT_PREVIEW_FRAME_STRICT_CSP
    )
    return Response(
        content = _ARTIFACT_PREVIEW_FRAME_HTML,
        media_type = "text/html; charset=utf-8",
        headers = {
            "Cache-Control": "no-store",
            "Content-Security-Policy": csp,
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )

