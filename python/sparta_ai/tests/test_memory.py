import pytest

from sparta_ai.memory.extractor import (
    extract_memory,
    is_trivial_turn,
    build_extraction_prompt,
    parse_extraction_response,
)
from sparta_ai.memory.graph_memory import (
    add_entity,
    add_relation,
    query_graph,
    extract_entities_from_text,
    get_all_entities,
    get_all_relations,
    clear,
)
from sparta_ai.skills.skill_loader import build_skills_context, list_available_skills, clear_skill_cache


class TestExtractor:
    def test_extract_memory_basic(self):
        result = extract_memory(
            "Me llamo Juan y trabajo con Python",
            "Hola Juan, Python es un gran lenguaje para IA",
        )
        assert "entities" in result
        assert "facts" in result
        assert "relations" in result

    def test_is_trivial_turn(self):
        assert is_trivial_turn("hola", "hola") is True
        assert is_trivial_turn("gracias", "de nada") is True
        assert is_trivial_turn("Cómo se crea un agente en LangGraph?",
                               "Se usa StateGraph...") is False

    def test_build_extraction_prompt(self):
        prompt = build_extraction_prompt("Hola", "Adiós")
        assert "Extrae" in prompt
        assert "Usuario: Hola" in prompt

    def test_parse_extraction_response_valid(self):
        response = '{"entities": [{"name": "Python", "type": "technology", "confidence": 0.8}], "facts": [], "relations": []}'
        result = parse_extraction_response(response)
        assert len(result["entities"]) == 1
        assert result["entities"][0]["name"] == "Python"

    def test_parse_extraction_response_invalid(self):
        result = parse_extraction_response("No hay JSON aquí")
        assert result["entities"] == []
        assert result["facts"] == []
        assert result["relations"] == []

    def test_parse_extraction_response_empty(self):
        result = parse_extraction_response("")
        assert result["entities"] == []
        assert result["facts"] == []


class TestGraphMemory:
    def setup_method(self):
        clear()

    def test_add_and_query_entity(self):
        add_entity("ent_001", "Python", "technology")
        add_entity("ent_002", "LangGraph", "technology")
        add_relation("ent_001", "ent_002", "related_to")

        results = query_graph("Python")
        assert len(results) > 0
        assert "Python" in results[0]

    def test_extract_entities_from_text(self):
        entities = extract_entities_from_text(
            "Trabajo con Python y React, también uso Docker"
        )
        names = [e["name"].lower() for e in entities]
        assert "python" in names
        assert "react" in names
        assert "docker" in names

    def test_get_all_entities(self):
        clear()
        add_entity("e1", "Test", "concept")
        assert len(get_all_entities()) == 1
        assert len(get_all_relations()) == 0

    def test_clear(self):
        add_entity("e1", "Test", "concept")
        clear()
        assert len(get_all_entities()) == 0


class TestSkillLoader:
    def test_build_skills_context_empty(self):
        assert build_skills_context([]) == ""

    def test_build_skills_context_nonexistent(self):
        result = build_skills_context(["nonexistent_skill"])
        assert result == ""

    def test_list_available_skills(self):
        clear_skill_cache()
        skills = list_available_skills()
        assert isinstance(skills, list)
