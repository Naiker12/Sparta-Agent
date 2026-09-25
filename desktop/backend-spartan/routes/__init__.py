
"""
API Routes
"""

from routes.inference import router as inference_router
from routes.inference import studio_router as inference_studio_router
from routes.auth import router as auth_router
from routes.chat_history import router as chat_history_router
from routes.providers import router as providers_router

from routes.openai_codex_auth import router as openai_codex_auth_router
from routes.mcp_servers import router as mcp_servers_router
from routes.research_runs import router as research_runs_router
from routes.youtube import router as youtube_router
from routes.skills import router as skills_router

__all__ = [
    "inference_router",
    "inference_studio_router",
    "auth_router",
    "chat_history_router",
    "providers_router",
    "openai_codex_auth_router",
    "mcp_servers_router",
    "research_runs_router",
    "youtube_router",
    "skills_router",
]

# Bind the re-export so the import-hoist verifier counts it as used.
_ = (research_runs_router, youtube_router, skills_router)
