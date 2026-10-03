"""Isolation and evidence retention in the conversational graph."""
import sqlite3
import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch
from storage.studio import conversation_memory as memory
from core.inference import memory_actions


class ConversationMemoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "memory.db"
        def connection():
            conn = sqlite3.connect(self.path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("CREATE TABLE IF NOT EXISTS chat_threads(id TEXT PRIMARY KEY, project_id TEXT, archived INTEGER)")
            conn.execute("INSERT OR IGNORE INTO chat_threads VALUES('thread','project',0)")
            conn.commit()
            return conn
        self.patch = patch.object(memory, "get_connection", connection)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_episodes_are_idempotent_and_responses_keep_role(self):
        messages = [
            dict(id="question", threadId="thread", role="user", content=[dict(type="text", text="¿Qué clima hace?")], createdAt=1),
            dict(id="answer", threadId="thread", parentId="question", role="assistant", content=[dict(type="text", text="Una respuesta generada")], createdAt=2),
        ]
        memory.capture("alice", messages)
        memory.capture("alice", messages)
        graph = memory.graph("alice", "project")
        self.assertEqual(len(graph["nodes"]), 2)
        self.assertEqual(len(graph["edges"]), 1)
        self.assertEqual(memory.graph("bob")["nodes"], [])
        self.assertEqual(memory.graph("alice", "other")["nodes"], [])
        self.assertTrue(all(n["confidence"] == 0 for n in graph["nodes"]))
        self.assertEqual({n["sourceRole"] for n in graph["nodes"]}, {"user", "assistant"})
        answer = next(n for n in graph["nodes"] if n["sourceRole"] == "assistant")
        memory.remove("alice", answer["id"])
        memory.capture("alice", messages)
        self.assertEqual(len(memory.graph("alice")["nodes"]), 1)

    def test_direct_lookup_is_scoped_and_not_limited_to_visible_graph(self):
        first = memory.save("alice", dict(label="Original", content="Evidence"))
        for index in range(501):
            memory.save("alice", dict(label=str(index), content="Newer"))
        conn = memory.get_connection()
        conn.execute("UPDATE conversation_memory_nodes SET updated_at=0 WHERE id=?", (first["id"],))
        conn.commit()
        conn.close()
        self.assertNotIn(first["id"], {n["id"] for n in memory.graph("alice")["nodes"]})
        self.assertEqual(memory.get_node("alice", first["id"])["content"], "Evidence")
        self.assertIsNone(memory.get_node("bob", first["id"]))

    def test_cross_user_mutation_and_cross_project_edges_are_rejected(self):
        first = memory.save("alice", dict(label="A", content="A", projectId="one"))
        second = memory.save("alice", dict(label="B", content="B", projectId="two"))
        self.assertFalse(memory.remove("bob", first["id"]))
        with self.assertRaises(ValueError):
            memory.save("bob", dict(label="Changed", content="Changed"), first["id"])
        with self.assertRaises(ValueError):
            memory.connect("alice", first["id"], second["id"], "related")

    def test_retrieval_matches_terms_accents_and_scoped_relations(self):
        first = memory.save("alice", dict(label="Configuración Python", content="Prefiero Python", projectId="one"))
        linked = memory.save("alice", dict(label="Editor", content="Uso un editor local", projectId="one"))
        memory.connect("alice", first["id"], linked["id"], "contexto")
        memory.save("alice", dict(label="Configuración Python", content="Other project", projectId="two"))
        memory.save("bob", dict(label="Configuración Python", content="Other owner", projectId="one"))
        result = memory.retrieve("alice", "one", "como es la configuracion de Python")
        self.assertEqual(result[0]["id"], first["id"])
        self.assertEqual(result[1]["id"], linked["id"])
        self.assertEqual(result[1]["retrievalReason"], "relation")
        self.assertEqual(memory.retrieve("alice", "one", "astronomia"), [])
        self.assertEqual(memory.retrieve("alice", "one", "que como para"), [])

    def test_model_context_is_bounded_and_retains_unverified_source(self):
        messages = [dict(id="long", threadId="thread", role="assistant",
                         content="Python " * 5000, createdAt=1)]
        memory.capture("alice", messages)
        output = memory_actions.search_memory_for_model({"query": "Python"}, "thread")
        self.assertLess(len(output), 6200)
        evidence = json.loads(output.split("\n", 1)[1])
        self.assertEqual(evidence[0]["role"], "assistant")
        self.assertEqual(evidence[0]["sourceMessageId"], "long")
        self.assertEqual(evidence[0]["confidence"], 0)
        self.assertLessEqual(len(evidence[0]["content"]), 1200)

    def test_review_is_atomic_idempotent_and_scoped(self):
        memory.capture("alice", [dict(id="review", threadId="thread", role="user", content="Uso Python y SQLite.", createdAt=1)])
        source = memory.graph("alice")["nodes"][0]
        proposal = {"nodes": [dict(type="entity", label="Python", content="Python", quote="Python"),
                              dict(type="entity", label="SQLite", content="SQLite", quote="SQLite")],
                    "relations": [dict(source=0, target=1, relation="usa", quote="Python y SQLite")]}
        first = memory.accept_extraction("alice", source["id"], proposal, [0, 1])
        self.assertEqual(first, memory.accept_extraction("alice", source["id"], proposal, [0, 1]))
        self.assertEqual(len(memory.graph("alice")["nodes"]), 3)
        self.assertEqual(len(memory.graph("alice")["edges"]), 3)
        with self.assertRaises(ValueError):
            memory.accept_extraction("bob", source["id"], proposal, [0])
        proposal["nodes"][0]["quote"] = "invented"
        with self.assertRaises(ValueError):
            memory.accept_extraction("alice", source["id"], proposal, [0])
        self.assertEqual(len(memory.graph("alice")["nodes"]), 3)
        conn = memory.get_connection()
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM conversation_memory_evidence").fetchone()[0], 2)
        conn.close()


if __name__ == "__main__":
    unittest.main()
