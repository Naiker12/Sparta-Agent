import json
import unittest
from core.inference.memory_extraction import extract, validate_proposals


SOURCE = {"id": "episode", "sourceMessageId": "message", "sourceRole": "assistant",
          "content": "Uso Python y SQLite."}


class ExtractionTests(unittest.IsolatedAsyncioTestCase):
    def test_evidence_required_and_assistant_not_verified(self):
        valid = {"nodes": [{"type": "entity", "label": "Python", "content": "Python", "quote": "Python"}], "relations": []}
        result = validate_proposals(json.dumps(valid), SOURCE)
        self.assertFalse(result["verified"])
        self.assertEqual(result["status"], "pending_review")
        self.assertEqual(result["sourceMessageId"], "message")
        valid["nodes"][0]["quote"] = "Invented evidence"
        with self.assertRaises(ValueError):
            validate_proposals(json.dumps(valid), SOURCE)

    def test_bad_relation_and_extra_fields_rejected(self):
        with self.assertRaises(ValueError):
            validate_proposals(json.dumps({"nodes": [], "relations": [{"source": 0, "target": 1, "relation": "uses", "quote": "Python"}]}), SOURCE)
        with self.assertRaises(ValueError):
            validate_proposals('{"nodes": [], "relations": [], "owner":"other"}', SOURCE)

    async def test_stream_uses_no_tools_and_parses_split_content(self):
        class Client:
            async def stream_chat_completion(self, **kwargs):
                self.kwargs = kwargs
                for part in ('{"nodes":', '[],"relations":[]}'):
                    yield "data: " + json.dumps({"choices": [{"delta": {"content": part}}]}) + "\n\n"
                yield "data: [DONE]\n\n"
        client = Client()
        result = await extract(client, "configured-model", SOURCE)
        self.assertEqual(result["nodes"], [])
        self.assertEqual(client.kwargs["tool_choice"], "none")
        self.assertEqual(client.kwargs["enabled_tools"], [])


if __name__ == '__main__':
    unittest.main()
