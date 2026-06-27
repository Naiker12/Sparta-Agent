import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.graph")

_entities: dict[str, dict] = {}
_relations: list[dict] = []


def add_entity(entity_id: str, name: str, entity_type: str = "concept", properties: dict | None = None) -> None:
    _entities[entity_id] = {
        "id": entity_id,
        "name": name,
        "type": entity_type,
        "properties": properties or {},
        "created_at": __import__("time").time(),
    }
    logger.debug("Entity added: %s (%s)", name, entity_type)


def add_relation(
    source_id: str,
    target_id: str,
    relation_type: str,
    properties: dict | None = None,
) -> None:
    rel = {
        "source": source_id,
        "target": target_id,
        "type": relation_type,
        "properties": properties or {},
        "created_at": __import__("time").time(),
    }
    _relations.append(rel)
    logger.debug("Relation added: %s --[%s]--> %s", source_id[:8], relation_type, target_id[:8])


def query_graph(query: str) -> list[str]:
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
    return list(_entities.values())


def get_all_relations() -> list[dict]:
    return list(_relations)


def clear() -> None:
    _entities.clear()
    _relations.clear()
    logger.info("Graph memory cleared")
