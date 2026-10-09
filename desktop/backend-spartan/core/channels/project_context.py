"""Read bounded project instructions and indexed excerpts; never crawl local paths."""
import json
import logging
from pathlib import PurePosixPath

from storage.channels import repository as repo, projects
from storage.studio.chat_projects import get_chat_project
from .permissions import project_context_allowed

logger = logging.getLogger(__name__)
MAX_INSTRUCTIONS = 6000
MAX_EXCERPTS = 10000
MAX_CHUNK = 2500


class ProjectContextRevoked(Exception):
    pass


def scope(account_id, user_id):
    account = repo.get_account(account_id)
    if not account or not account['enabled'] or user_id not in account['allowed_user_ids']:
        return None
    project = projects.selected(account_id, user_id)
    return [project['id'] if project else None, project_context_allowed(account, user_id)]


def check(account_id, user_id, expected):
    if scope(account_id, user_id) != expected:
        raise ProjectContextRevoked()


def indexed_excerpts(project_id, query):
    from storage import rag_db
    from core.rag import store
    conn = None
    try:
        conn = rag_db.get_connection()
        hits = store.search_lexical(conn, store.project_scope(project_id), query[:2000], 4)
        rows = store.chunks_by_id(conn, [identifier for identifier, _ in hits])
        excerpts, size = [], 0
        for identifier, _ in hits:
            row = rows.get(identifier)
            if row is None:
                continue
            text = row['text'][:min(MAX_CHUNK, MAX_EXCERPTS - size)]
            # Only a display filename travels to the provider, never a filesystem path.
            filename = PurePosixPath(str(row['filename']).replace('\\', '/')).name[:160]
            excerpts.append({'source': filename, 'page': row['page_number'], 'text': text})
            size += len(text)
        return excerpts, 'matched' if excerpts else 'no_matches'
    except rag_db.RagExtensionUnavailable:
        return [], 'unavailable'
    except Exception:
        logger.warning('Channel project index retrieval unavailable', exc_info=False)
        return [], 'unavailable'
    finally:
        if conn is not None:
            conn.close()


def load(account_id, user_id, query):
    expected = scope(account_id, user_id)
    if expected is None or expected[0] is None or not expected[1]:
        return expected, None
    project = get_chat_project(expected[0])
    if not project or project['archived']:
        raise ProjectContextRevoked()
    excerpts, status = indexed_excerpts(project['id'], query)
    check(account_id, user_id, expected)
    return expected, json.dumps({
        'project': project['name'][:160],
        'instructions': project.get('instructions', '')[:MAX_INSTRUCTIONS],
        'instructions_truncated': len(project.get('instructions', '')) > MAX_INSTRUCTIONS,
        'excerpts': excerpts, 'index_status': status,
        'limits': 'Only these saved instructions and matching indexed excerpts were read. No folders or other projects were opened.',
    }, ensure_ascii=False)
