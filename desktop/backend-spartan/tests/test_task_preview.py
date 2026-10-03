import json
import unittest
from core.inference.task_preview import preview_task


class FakeClient:
    def __init__(self, delta):
        self.delta = delta
        self.kwargs = None

    async def stream_chat_completion(self, **kwargs):
        self.kwargs = kwargs
        yield 'data: ' + json.dumps({'choices': [{'delta': self.delta}]})
        yield 'data: [DONE]'


class TaskPreviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_text_only(self):
        client = FakeClient({'content': 'Result'})
        self.assertEqual(await preview_task(client, 'model', 'Instructions'), 'Result')
        self.assertEqual(client.kwargs['tools'], [])
        self.assertEqual(client.kwargs['enabled_tools'], [])
        self.assertEqual(client.kwargs['tool_choice'], 'none')
        self.assertEqual(client.kwargs['messages'][1]['content'], 'Instructions')

    async def test_rejects_empty_tools_and_oversized_output(self):
        for delta in ({}, {'tool_calls': [{'id': 'x'}]}, {'content': 'x' * 24001}):
            with self.assertRaises(ValueError):
                await preview_task(FakeClient(delta), 'model', 'Instructions')
