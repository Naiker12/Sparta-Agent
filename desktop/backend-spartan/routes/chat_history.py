"""
Chat history API routes backed by studio.db.

This module acts as a transparent unified facade and orchestrator for all
modular sub-routers in `routes.chat.*`.
"""

from fastapi import APIRouter

# Re-export all schemas and helpers
from routes.chat.schemas import *
from routes.chat.helpers import *

# Import sub-routers
from routes.chat.router_threads import (
    router as threads_router,
    clear_history,
    count_threads,
    delete_threads,
    get_import_ledger,
    get_thread,
    list_threads,
    patch_thread,
    record_import_ledger,
    save_thread,
)
from routes.chat.router_projects import (
    router as projects_router,
    delete_project,
    get_project,
    list_projects,
    patch_project,
    patch_project_workspace,
    save_project,
)
from routes.chat.router_workspaces import (
    router as workspaces_router,
    bind_thread_workspace,
    get_thread_workspace,
    unbind_thread_workspace,
)
from routes.chat.router_messages import (
    router as messages_router,
    batch_thread_messages,
    get_thread_message,
    get_thread_messages,
    replace_thread_messages,
    save_thread_message,
)
from routes.chat.router_attachments import (
    router as attachments_router,
    delete_attachment,
    get_attachment_file,
    list_attachments,
)
from routes.chat.router_forks import (
    router as forks_router,
    fork_thread,
    get_fork_count,
    get_thread_fork_counts,
)
from routes.chat.router_settings import (
    router as settings_router,
    export_history,
    get_settings,
    put_settings,
)

# Unified router with all 32 endpoint routes populated directly
router = APIRouter()
for sub in (
    threads_router,
    projects_router,
    workspaces_router,
    messages_router,
    attachments_router,
    forks_router,
    settings_router,
):
    for r in sub.routes:
        router.routes.append(r)
