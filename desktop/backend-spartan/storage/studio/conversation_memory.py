"""Scoped conversational graph. Episodes retain evidence, never inferred truth."""
import hashlib
import time
import uuid
import re
import unicodedata

from storage.studio.connection import get_connection


def _open():
    conn = get_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS conversation_memory_nodes (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, project TEXT NOT NULL,
        kind TEXT NOT NULL, label TEXT NOT NULL, content TEXT NOT NULL,
        thread_id TEXT, message_id TEXT, role TEXT, confidence REAL NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        UNIQUE(owner, message_id))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS conversation_memory_edges (
        id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES conversation_memory_nodes(id) ON DELETE CASCADE,
        target TEXT NOT NULL REFERENCES conversation_memory_nodes(id) ON DELETE CASCADE,
        relation TEXT NOT NULL, UNIQUE(source,target,relation))""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_conversation_memory_scope ON conversation_memory_nodes(owner,project,updated_at)")
    conn.execute("CREATE TABLE IF NOT EXISTS conversation_memory_forgotten(owner TEXT NOT NULL,message_id TEXT NOT NULL,PRIMARY KEY(owner,message_id))")
    conn.execute("""CREATE TABLE IF NOT EXISTS conversation_memory_evidence(
        node_id TEXT NOT NULL REFERENCES conversation_memory_nodes(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES conversation_memory_nodes(id) ON DELETE CASCADE,
        quote TEXT NOT NULL, PRIMARY KEY(node_id,source_id))""")
    conn.commit()
    return conn


def _node(row):
    return {"id": row["id"], "type": row["kind"], "label": row["label"],
            "content": row["content"], "sourceThreadId": row["thread_id"],
            "sourceMessageId": row["message_id"], "sourceRole": row["role"],
            "projectId": row["project"] or None, "confidence": row["confidence"],
            "createdAt": row["created_at"], "updatedAt": row["updated_at"]}


def graph(owner, project=None, query=None):
    conn = _open()
    try:
        where, values = ["owner=?"], [owner]
        if project is not None:
            where.append("project=?")
            values.append(project)
        if query:
            where.append("(label LIKE ? OR content LIKE ?)")
            values.extend([f"%{query}%", f"%{query}%"])
        rows = conn.execute("SELECT * FROM conversation_memory_nodes WHERE " +
                            " AND ".join(where) + " ORDER BY updated_at DESC LIMIT 500", values).fetchall()
        ids = {row["id"] for row in rows}
        edges = conn.execute("""SELECT e.* FROM conversation_memory_edges e
            JOIN conversation_memory_nodes n ON n.id=e.source WHERE n.owner=?""", (owner,)).fetchall()
        return {"nodes": [_node(row) for row in rows],
                "edges": [dict(row) for row in edges if row["source"] in ids and row["target"] in ids]}
    finally:
        conn.close()


def get_node(owner, node_id):
    """Read a single scoped node independently of the graph display limit."""
    conn = _open()
    try:
        row = conn.execute("SELECT * FROM conversation_memory_nodes WHERE owner=? AND id=?",
                           (owner, node_id)).fetchone()
        if row is None:
            return None
        result = _node(row)
        evidence = conn.execute("""SELECT e.source_id, e.quote, n.thread_id, n.role
            FROM conversation_memory_evidence e
            JOIN conversation_memory_nodes n ON n.id=e.source_id
            WHERE e.node_id=? AND n.owner=?""", (node_id, owner)).fetchall()
        result["evidence"] = [{"sourceId": item["source_id"], "quote": item["quote"],
                               "sourceThreadId": item["thread_id"], "sourceRole": item["role"]}
                              for item in evidence]
        return result
    finally:
        conn.close()


def _terms(text):
    normalized = unicodedata.normalize("NFKD", text.casefold())
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    stop = {"que", "como", "con", "para", "por", "una", "los", "las", "del", "the", "and", "what", "does"}
    return {word for word in re.findall(r"\w+", normalized) if len(word) > 2 and word not in stop}


def retrieve(owner, project, query, limit=8):
    """Lexical relevance plus one-hop evidence, scoped before ranking.

    This is deliberately not advertised as embedding/semantic search.
    Recency only breaks relevance ties; unrelated recent episodes cannot win.
    """
    terms = _terms(query[:1000])
    if not terms:
        return []
    conn = _open()
    try:
        # Unlike the visual graph limit, retrieval considers the full scope.
        rows = conn.execute("SELECT * FROM conversation_memory_nodes WHERE owner=? AND project=?",
                            (owner, project or "")).fetchall()
        by_id = {row["id"]: row for row in rows}
        scores = {}
        for row in rows:
            title_matches = terms & _terms(row["label"])
            body_matches = terms & _terms(row["content"])
            score = len(title_matches) * 2 + len(body_matches)
            if score:
                scores[row["id"]] = (score, "text")
        if not scores:
            return []
        seeds = sorted(scores, key=lambda key: (scores[key][0], by_id[key]["updated_at"]), reverse=True)[:limit]
        edges = conn.execute("""SELECT e.source,e.target FROM conversation_memory_edges e
            JOIN conversation_memory_nodes s ON s.id=e.source
            JOIN conversation_memory_nodes t ON t.id=e.target
            WHERE s.owner=? AND t.owner=? AND s.project=? AND t.project=?""",
            (owner, owner, project or "", project or "")).fetchall()
        seed_set = set(seeds)
        for edge in edges:
            for seed, neighbor in ((edge["source"], edge["target"]), (edge["target"], edge["source"])):
                if seed in seed_set and neighbor in by_id and neighbor not in scores:
                    scores[neighbor] = (0.5, "relation")
        ranked = sorted(scores, key=lambda key: (scores[key][0], by_id[key]["updated_at"]), reverse=True)
        return [dict(_node(by_id[key]), retrievalReason=scores[key][1]) for key in ranked[:max(1, min(limit, 20))]]
    finally:
        conn.close()


def save(owner, data, node_id=None):
    conn = _open()
    try:
        now = int(time.time() * 1000)
        node_id = node_id or str(uuid.uuid4())
        existing = conn.execute("SELECT owner FROM conversation_memory_nodes WHERE id=?", (node_id,)).fetchone()
        if existing and existing["owner"] != owner:
            raise ValueError("Memory not found")
        conn.execute("""INSERT INTO conversation_memory_nodes
            (id,owner,project,kind,label,content,thread_id,message_id,role,confidence,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            label=excluded.label, content=excluded.content, kind=excluded.kind, updated_at=excluded.updated_at""",
            (node_id, owner, data.get("projectId") or "", data.get("type", "fact"),
             data["label"], data["content"], data.get("sourceThreadId"), None, None,
             data.get("confidence", 1), now, now))
        conn.commit()
        return _node(conn.execute("SELECT * FROM conversation_memory_nodes WHERE id=?", (node_id,)).fetchone())
    finally:
        conn.close()


def accept_extraction(owner, source_id, extraction, selected_indices):
    """Atomically save reviewed proposals and their source links; retry-safe."""
    from core.inference.memory_extraction import validate_proposals
    import json
    conn = _open()
    try:
        conn.execute("BEGIN IMMEDIATE")
        source = conn.execute("SELECT * FROM conversation_memory_nodes WHERE owner=? AND id=?",
                              (owner, source_id)).fetchone()
        if source is None or not source["message_id"]:
            raise ValueError("Original episode not found")
        # Revalidate submitted evidence against server-held text, not browser text.
        validated = validate_proposals(json.dumps(extraction), _node(source))
        indices = set(selected_indices)
        if not indices or any(i < 0 or i >= len(validated["nodes"]) for i in indices):
            raise ValueError("Select valid proposals")
        ids = {}
        now = int(time.time() * 1000)
        for index in sorted(indices):
            proposal = validated["nodes"][index]
            identity = json.dumps(proposal, sort_keys=True, ensure_ascii=False)
            node_id = hashlib.sha256(f"{owner}:{source_id}:{identity}".encode()).hexdigest()
            ids[index] = node_id
            conn.execute("""INSERT OR IGNORE INTO conversation_memory_nodes
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""", (node_id, owner, source["project"],
                proposal["type"], proposal["label"], proposal["content"], source["thread_id"],
                None, source["role"], 0, now, now))
            edge_id = hashlib.sha256(f"{source_id}:{node_id}:source".encode()).hexdigest()
            conn.execute("INSERT OR IGNORE INTO conversation_memory_edges VALUES(?,?,?,?)",
                         (edge_id, source_id, node_id, "fuente"))
            conn.execute("INSERT OR IGNORE INTO conversation_memory_evidence VALUES(?,?,?)",
                         (node_id, source_id, proposal["quote"]))
        for relation in validated["relations"]:
            if relation["source"] not in ids or relation["target"] not in ids:
                continue
            start, end = ids[relation["source"]], ids[relation["target"]]
            edge_id = hashlib.sha256(f"{start}:{end}:{relation['relation']}".encode()).hexdigest()
            conn.execute("INSERT OR IGNORE INTO conversation_memory_edges VALUES(?,?,?,?)",
                         (edge_id, start, end, relation["relation"]))
        conn.commit()
        return {"nodeIds": list(ids.values())}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def connect(owner, source, target, relation):
    conn = _open()
    try:
        rows = conn.execute("SELECT owner,project FROM conversation_memory_nodes WHERE id IN (?,?)", (source,target)).fetchall()
        if len(rows) != 2 or any(row["owner"] != owner for row in rows) or rows[0]["project"] != rows[1]["project"]:
            raise ValueError("Both nodes must belong to the same user and project")
        edge_id = hashlib.sha256(f"{source}:{target}:{relation}".encode()).hexdigest()
        conn.execute("INSERT OR IGNORE INTO conversation_memory_edges VALUES(?,?,?,?)", (edge_id,source,target,relation))
        conn.commit()
        return {"id": edge_id, "source": source, "target": target, "relation": relation}
    finally:
        conn.close()


def remove(owner, node_id):
    conn = _open()
    try:
        row = conn.execute("SELECT message_id FROM conversation_memory_nodes WHERE owner=? AND id=?", (owner,node_id)).fetchone()
        if row and row["message_id"]:
            conn.execute("INSERT OR IGNORE INTO conversation_memory_forgotten VALUES(?,?)", (owner,row["message_id"]))
        result = conn.execute("DELETE FROM conversation_memory_nodes WHERE owner=? AND id=?", (owner,node_id))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def remove_edge(owner, edge_id):
    conn = _open()
    try:
        result = conn.execute("""DELETE FROM conversation_memory_edges WHERE id=? AND source IN
            (SELECT id FROM conversation_memory_nodes WHERE owner=?)""", (edge_id, owner))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def thread_scope(thread_id):
    """Derive tool scope from server-held evidence, never model arguments."""
    conn = _open()
    try:
        rows = conn.execute("SELECT DISTINCT owner,project FROM conversation_memory_nodes WHERE thread_id=?", (thread_id,)).fetchall()
        return (rows[0]["owner"], rows[0]["project"]) if len(rows) == 1 else None
    finally:
        conn.close()


def capture(owner, messages):
    """Idempotently retain persisted user/assistant text with reply links."""
    conn = _open()
    try:
        count = 0
        for message in messages:
            if conn.execute("SELECT 1 FROM conversation_memory_forgotten WHERE owner=? AND message_id=?", (owner,message["id"])).fetchone():
                continue
            if message.get("role") not in {"user", "assistant"}:
                continue
            parts = message.get("content", [])
            text = parts if isinstance(parts, str) else "\n".join(
                part.get("text", "") for part in parts
                if isinstance(part, dict) and part.get("type") == "text") if isinstance(parts, list) else ""
            if not text.strip():
                continue
            thread = conn.execute("SELECT project_id,archived FROM chat_threads WHERE id=?", (message["threadId"],)).fetchone()
            if not thread or thread["archived"]:
                continue
            node_id = hashlib.sha256(f"{owner}:{message['id']}".encode()).hexdigest()
            now = int(time.time() * 1000)
            conn.execute("""INSERT INTO conversation_memory_nodes
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                content=excluded.content,label=excluded.label,project=excluded.project,
                updated_at=CASE WHEN content<>excluded.content THEN excluded.updated_at ELSE updated_at END""",
                (node_id,owner,thread["project_id"] or "","event",text.strip()[:100],text,
                 message["threadId"],message["id"],message["role"],0,
                 message["createdAt"],now))
            parent = message.get("parentId")
            if parent:
                parent_id = hashlib.sha256(f"{owner}:{parent}".encode()).hexdigest()
                parent_row = conn.execute("SELECT thread_id FROM conversation_memory_nodes WHERE id=?", (parent_id,)).fetchone()
                if parent_row and parent_row["thread_id"] == message["threadId"]:
                    edge_id = hashlib.sha256(f"{parent_id}:{node_id}".encode()).hexdigest()
                    conn.execute("INSERT OR IGNORE INTO conversation_memory_edges VALUES(?,?,?,?)",
                                 (edge_id,parent_id,node_id,"respuesta" if message["role"] == "assistant" else "continúa"))
            count += 1
        conn.commit()
        return count
    finally:
        conn.close()
