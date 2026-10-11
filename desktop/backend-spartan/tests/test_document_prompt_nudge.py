from routes.inference import _build_tool_action_nudge
from core.documents.generation import GENERATE_DOCUMENT_TOOL
from core.inference.tools import PYTHON_TOOL

def test_document_only_turn_receives_renderer_guidance():
    prompt = _build_tool_action_nudge(tools=[GENERATE_DOCUMENT_TOOL], model_name='model')
    assert 'use generate_document' in prompt
    assert 'do not probe or install reportlab' in prompt

def test_code_enabled_does_not_override_document_renderer():
    prompt = _build_tool_action_nudge(tools=[PYTHON_TOOL, GENERATE_DOCUMENT_TOOL], model_name='model')
    assert 'use generate_document' in prompt
    assert 'computation or custom processing' in prompt

def test_document_guidance_is_not_added_to_code_only_turn():
    prompt = _build_tool_action_nudge(tools=[PYTHON_TOOL], model_name='model')
    assert 'use generate_document' not in prompt
