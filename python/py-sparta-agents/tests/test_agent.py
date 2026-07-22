import pytest
from unittest.mock import patch, MagicMock

from sparta_agents.router import classify_intent
from sparta_agents.sparta_agent import SpartaState, build_sparta_graph


class TestRouter:
    def test_classify_chat(self):
        assert classify_intent("Hola, ¿cómo estás?") == "chat"
        assert classify_intent("Qué tal el día?") == "chat"

    def test_classify_code_task(self):
        assert classify_intent("Escribe un script de python") == "code_task"
        assert classify_intent("refactoriza este código") == "code_task"
        assert classify_intent("npm install react") == "code_task"

    def test_classify_research(self):
        assert classify_intent("Busca información sobre LangGraph") == "research"
        assert classify_intent("Investiga qué es Rust") == "research"

    def test_classify_memory(self):
        assert classify_intent("Recuérdame qué es Sparta") == "memory_query"
        assert classify_intent("Qué sabes de mi proyecto?") == "memory_query"

    def test_classify_with_skills(self):
        assert classify_intent("Hola", active_skills=["coding"]) == "agent"
        assert classify_intent("Hola", active_skills=["research"]) == "research"


class TestSpartaGraph:
    def test_graph_structure(self):
        mock_llm = MagicMock()
        mock_tools = []

        graph = build_sparta_graph(llm=mock_llm, tools=mock_tools)
        assert graph is not None

    def test_state_defaults(self):
        state: SpartaState = {
            "messages": [],
            "session_id": "test_001",
            "mode": "chat",
            "active_skills": [],
            "memory_context": "",
            "thinking_tokens": 0,
            "tool_calls_this_turn": 0,
            "subagent_results": [],
            "pending_human_input": None,
            "abort_requested": False,
        }
        assert state["session_id"] == "test_001"
        assert state["mode"] == "chat"
        assert state["abort_requested"] is False
