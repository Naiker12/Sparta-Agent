import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.memory.graph")

DATA_DIR = Path(os.environ.get("SPARTA_DATA_DIR", Path.home() / ".sparta"))
GRAPH_FILE = DATA_DIR / "memory" / "graph.json"

_cache: dict[str, Any] | None = None


def _load() -> tuple[dict[str, dict], list[dict]]:
    if GRAPH_FILE.exists():
        try:
            data = json.loads(GRAPH_FILE.read_text(encoding="utf-8"))
            return data.get("entities", {}), data.get("relations", [])
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load graph memory from %s: %s", GRAPH_FILE, e)
    return {}, []


def _save(entities: dict[str, dict], relations: list[dict]) -> None:
    try:
        GRAPH_FILE.parent.mkdir(parents=True, exist_ok=True)
        GRAPH_FILE.write_text(
            json.dumps({"entities": entities, "relations": relations}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("Failed to save graph memory to %s: %s", GRAPH_FILE, e)


def _get_state() -> tuple[dict[str, dict], list[dict]]:
    global _cache
    if _cache is None:
        entities, relations = _load()
        _cache = {"entities": entities, "relations": relations}
    return _cache["entities"], _cache["relations"]


def add_entity(entity_id: str, name: str, entity_type: str = "concept", properties: dict | None = None) -> None:
    _entities, _relations = _get_state()
    _entities[entity_id] = {
        "id": entity_id,
        "name": name,
        "type": entity_type,
        "properties": properties or {},
        "created_at": __import__("time").time(),
    }
    _save(_entities, _relations)
    logger.debug("Entity added: %s (%s)", name, entity_type)


def add_relation(
    source_id: str,
    target_id: str,
    relation_type: str,
    properties: dict | None = None,
) -> None:
    _entities, _relations = _get_state()
    rel = {
        "source": source_id,
        "target": target_id,
        "type": relation_type,
        "properties": properties or {},
        "created_at": __import__("time").time(),
    }
    _relations.append(rel)
    _save(_entities, _relations)
    logger.debug("Relation added: %s --[%s]--> %s", source_id[:8], relation_type, target_id[:8])


def query_graph(query: str) -> list[str]:
    _entities, _relations = _get_state()
    query_lower = query.lower()
    results = []

    for entity_id, entity in _entities.items():
        if query_lower in entity["name"].lower():
            related = []
            for rel in _relations:
                if rel["source"] == entity_id:
                    target = _entities.get(rel["target"])
                    if target:
                        related.append(f"--[{rel['type']}]--> {target['name']}")
                elif rel["target"] == entity_id:
                    source = _entities.get(rel["source"])
                    if source:
                        related.append(f"{source['name']} --[{rel['type']}]-->")

            line = f"Entidad: {entity['name']} ({entity['type']})"
            if related:
                line += " | " + "; ".join(related[:5])
            results.append(line)

    return results


def extract_entities_from_text(text: str) -> list[dict]:
    import re
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
                    "id": str(__import__("hashlib").md5(name.encode()).hexdigest()[:12]),
                    "name": name,
                    "type": entity_type,
                })
    return entities


def get_all_entities() -> list[dict]:
    _entities, _ = _get_state()
    return list(_entities.values())


def get_all_relations() -> list[dict]:
    _, _relations = _get_state()
    return list(_relations)


def clear() -> None:
    global _cache
    _cache = {"entities": {}, "relations": []}
    _save({}, [])
    logger.info("Graph memory cleared")
