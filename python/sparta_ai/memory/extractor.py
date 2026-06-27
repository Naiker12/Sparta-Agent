import json
import logging
import re
from typing import Any

logger = logging.getLogger("sparta_ai.memory.extractor")


def extract_memory(
    user_message: str,
    assistant_response: str,
) -> dict[str, Any]:
    entities = _extract_entities(user_message, assistant_response)
    facts = _extract_facts(user_message, assistant_response)
    relations = _extract_relations(entities, facts)

    return {
        "entities": entities,
        "facts": facts,
        "relations": relations,
    }


def _extract_entities(user_msg: str, assistant_msg: str) -> list[dict]:
    combined = f"{user_msg} {assistant_msg}"
    patterns = [
        (r'\b[A-Z][a-z]+\b', "person"),
        (r'\b(python|javascript|typescript|rust|go|java|react|angular|vue|node|deno'
         r'|postgres|mysql|mongodb|redis|docker|kubernetes|aws|gcp|azure)\b', "technology"),
        (r'\b(proyecto|aplicación|sistema|plataforma|api|sdk|framework|biblioteca|'
         r'librería|herramienta|servicio|base de datos)\b', "concept"),
    ]
    entities = []
    seen = set()
    stop_words = {'con', 'del', 'las', 'los', 'por', 'para', 'con', 'que', 'una', 'sus'}

    for pattern, entity_type in patterns:
        for match in re.finditer(pattern, combined, re.IGNORECASE):
            name = match.group(0)
            key = name.lower()
            if key not in seen and len(name) > 2 and key not in stop_words:
                seen.add(key)
                entities.append({
                    "name": name,
                    "type": entity_type,
                    "confidence": 0.8,
                })
    return entities


def _extract_facts(user_msg: str, assistant_msg: str) -> list[dict]:
    patterns = [
        r'[Ll]lama(?:do|da|r(?:se)?|mos?)?\s+(?:a\s+)?["“]?([^"”.!?]+)["”]?',
        r'(?:es|son|está|están|tiene|tienen|usa|usan|utiliza|utilizan)\s+([^.!?]+)',
        r'(?:prefiero|prefieres|gusta|gustan|interesa|interesan)\s+([^.!?]+)',
    ]
    facts = []
    seen = set()

    for text in (user_msg, assistant_msg):
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                fact_text = match.group(1).strip().lower()
                key = fact_text[:50]
                if key not in seen and len(fact_text) > 5:
                    seen.add(key)
                    facts.append({
                        "fact": fact_text,
                        "source": "user" if text == user_msg else "assistant",
                        "confidence": 0.7,
                    })
    return facts


def _extract_relations(entities: list[dict], facts: list[dict]) -> list[dict]:
    relations = []
    if entities and facts:
        for entity in entities[:3]:
            for fact in facts[:3]:
                relations.append({
                    "source": entity["name"],
                    "target": fact["fact"][:30],
                    "type": "semantic_relation",
                    "confidence": 0.5,
                })
    return relations


def is_trivial_turn(user_message: str, assistant_response: str) -> bool:
    trivial_patterns = [
        r'^(hola|hey|buenas|ok|okay|gracias|thx|thanks|sí|si|no|:-?\))$',
        r'^(cómo estás|como estas|que tal|qué tal|bien y tú)$',
    ]
    clean = user_message.strip().lower()
    for pattern in trivial_patterns:
        if re.match(pattern, clean):
            return True
    return len(assistant_response.strip()) < 10


def build_extraction_prompt(user_message: str, assistant_response: str) -> str:
    return f"""Extrae entidades, hechos y relaciones del siguiente intercambio:

Usuario: {user_message}
Asistente: {assistant_response}

Responde en JSON con este formato exacto:
{{"entities": [{{"name": "...", "type": "person|technology|concept", "confidence": 0.8}}],
 "facts": [{{"fact": "...", "source": "user|assistant", "confidence": 0.7}}],
 "relations": [{{"source": "...", "target": "...", "type": "semantic_relation", "confidence": 0.5}}]}}"""


def parse_extraction_response(response: str) -> dict[str, Any]:
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if not json_match:
        logger.warning("No JSON found in extraction response")
        return {"entities": [], "facts": [], "relations": []}

    try:
        data = json.loads(json_match.group(0))
        return {
            "entities": data.get("entities", []),
            "facts": data.get("facts", []),
            "relations": data.get("relations", []),
        }
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse extraction JSON: %s", e)
        return {"entities": [], "facts": [], "relations": []}
