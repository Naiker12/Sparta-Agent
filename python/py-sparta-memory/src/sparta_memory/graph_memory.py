import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.memory.graph")

DATA_DIR = Path(os.environ.get("SPARTA_DATA_DIR", Path.home() / ".sparta"))
DB_PATH = DATA_DIR / "memory" / "graph.db"

_connection: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _connection = sqlite3.connect(str(DB_PATH))
        _connection.row_factory = sqlite3.Row
        _init_schema(_connection)
    return _connection


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'concept',
            data TEXT NOT NULL DEFAULT '{}',
            confidence REAL NOT NULL DEFAULT 1.0,
            session_id TEXT,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL REFERENCES entities(id),
            target_id TEXT NOT NULL REFERENCES entities(id),
            relation_type TEXT NOT NULL,
            data TEXT NOT NULL DEFAULT '{}',
            created_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rel_source ON relations(source_id);
        CREATE INDEX IF NOT EXISTS idx_rel_target ON relations(target_id);
        CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type);
        CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name);
    """)
    conn.commit()


def _dict_from_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["data"] = json.loads(d.get("data", "{}"))
    return d


def add_entity(
    entity_id: str,
    name: str,
    entity_type: str = "concept",
    properties: dict | None = None,
    confidence: float = 1.0,
    session_id: str | None = None,
) -> None:
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO entities (id, name, type, data, confidence, session_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (entity_id, name, entity_type, json.dumps(properties or {}), confidence, session_id, time.time()),
    )
    conn.commit()
    logger.debug("Entity added: %s (%s)", name, entity_type)


def add_relation(
    source_id: str,
    target_id: str,
    relation_type: str,
    properties: dict | None = None,
) -> None:
    conn = _get_conn()
    conn.execute(
        """INSERT INTO relations (source_id, target_id, relation_type, data, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (source_id, target_id, relation_type, json.dumps(properties or {}), time.time()),
    )
    conn.commit()
    logger.debug("Relation added: %s --[%s]--> %s", source_id[:8], relation_type, target_id[:8])


def query_graph(query: str, min_confidence: float = 0.5) -> list[str]:
    conn = _get_conn()
    query_lower = query.lower()
    results = []

    rows = conn.execute(
        "SELECT * FROM entities WHERE LOWER(name) LIKE ? AND confidence >= ? ORDER BY confidence DESC",
        (f"%{query_lower}%", min_confidence),
    ).fetchall()

    for row in rows:
        entity = _dict_from_row(row)
        related = conn.execute(
            """SELECT r.relation_type, e.name AS target_name, e2.name AS source_name, r.source_id, r.target_id
               FROM relations r
               LEFT JOIN entities e ON r.target_id = e.id
               LEFT JOIN entities e2 ON r.source_id = e2.id
               WHERE r.source_id = ? OR r.target_id = ?
               LIMIT 5""",
            (row["id"], row["id"]),
        ).fetchall()

        rel_lines = []
        for rel in related:
            if rel["source_id"] == row["id"]:
                rel_lines.append(f"--[{rel['relation_type']}]--> {rel['target_name']}")
            else:
                rel_lines.append(f"{rel['source_name']} --[{rel['relation_type']}]-->")

        line = f"Entidad: {entity['name']} ({entity['type']})"
        if rel_lines:
            line += " | " + "; ".join(rel_lines)
        results.append(line)

    return results


def extract_entities_from_text(text: str) -> list[dict]:
    import re
    from hashlib import md5

    patterns = [
        (r'\b[A-Z][a-z]+\b', "person"),
        (r'\b(python|javascript|typescript|rust|go|java|react|angular|vue|node|deno|docker|kubernetes|postgres|mysql|mongodb|redis)\b', "technology"),
        (r'\b(proyecto|aplicación|sistema|plataforma|servicio|api|sdk|framework)\b', "concept"),
    ]
    entities = []
    seen = set()
    for pattern, entity_type in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            name = match.group(0)
            key = name.lower()
            if key not in seen and len(name) > 2 and key not in ('con', 'del', 'las', 'los', 'por', 'para', 'con'):
                seen.add(key)
                entities.append({
                    "id": md5(name.encode()).hexdigest()[:12],
                    "name": name,
                    "type": entity_type,
                })
    return entities


def get_all_entities() -> list[dict]:
    conn = _get_conn()
    return [_dict_from_row(r) for r in conn.execute("SELECT * FROM entities ORDER BY created_at DESC").fetchall()]


def get_all_relations() -> list[dict]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM relations ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def clear() -> None:
    conn = _get_conn()
    conn.executescript("DELETE FROM relations; DELETE FROM entities;")
    conn.commit()
    logger.info("Graph memory cleared")


def close() -> None:
    global _connection
    if _connection:
        _connection.close()
        _connection = None
        logger.debug("Graph memory connection closed")
