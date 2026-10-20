import copy
import json

import pytest

from core.inference.response_panels import present_ui, validate_panel


def panel():
    return {"version": 1, "title": "Plan", "layout": "grid", "blocks": [
        {"kind": "metric", "label": "Total", "value": "0"},
        {"kind": "form", "id": "details", "title": "Datos", "fields": [
            {"id": "name", "label": "Nombre", "type": "text", "required": True},
            {"id": "count", "label": "Cantidad", "type": "number", "min": 0, "max": 10},
            {"id": "choice", "label": "Opción", "type": "select", "options": ["A", "B"]},
        ]},
    ]}


def test_panel_is_display_only_and_has_canonical_text():
    value = panel()
    before = copy.deepcopy(value)
    result = json.loads(present_ui({"panel": value}))
    assert value == before
    assert result["panel"] == value
    assert result["kind"] == "response_panel"
    assert "Total: 0" in result["fallbackText"]
    assert "Nombre" in result["fallbackText"]


@pytest.mark.parametrize("block", [
    {"kind": "script", "code": "run()"},
    {"kind": "text", "text": "Hello", "onClick": "run()"},
    {"kind": "form", "id": "x", "title": "x", "action": "https://example.org", "fields": []},
    {"kind": "form", "id": "x", "title": "x", "fields": [{"id": "password", "label": "Secret", "type": "password"}]},
    {"kind": "table", "columns": ["A", "B"], "rows": [["wrong length"]]},
])
def test_active_content_or_invalid_blocks_are_rejected(block):
    value = panel()
    value["blocks"] = [block]
    assert present_ui({"panel": value}).startswith("Error:")


def test_duplicate_ids_and_resource_limits_are_rejected():
    value = panel()
    value["blocks"].append(copy.deepcopy(value["blocks"][1]))
    with pytest.raises(ValueError): validate_panel(value)
    value = panel()
    value["blocks"] = [{"kind": "text", "text": "x"}] * 25
    assert present_ui({"panel": value}).startswith("Error:")


def test_tool_registration_and_dispatch_do_not_mutate_resources():
    from core.inference.tools import ALL_TOOLS, execute_tool, is_always_safe_tool
    assert any(tool["function"]["name"] == "present_ui" for tool in ALL_TOOLS)
    assert is_always_safe_tool("present_ui")
    result = json.loads(execute_tool("present_ui", {"panel": panel()}))
    assert result["kind"] == "response_panel"


def test_unknown_arguments_and_nonfinite_numbers_are_rejected():
    assert present_ui({"panel": panel(), "command": "run"}).startswith("Error:")
    value = panel()
    value["blocks"][1]["fields"][1]["max"] = float("inf")
    assert present_ui({"panel": value}).startswith("Error:")


def test_model_gets_a_compact_receipt_while_frontend_keeps_full_panel():
    from core.inference.tool_loop_controller import strip_result_for_model
    raw = present_ui({"panel": panel()})
    compact = json.loads(strip_result_for_model(raw, "present_ui"))
    assert compact == {"presentationPrepared": True, "title": "Plan", "forms": ["details"], "externalActionExecuted": False,
                       "nextStep": "The panel is already visible. Reply with at most one brief confirmation; do not repeat its fields or instructions. If it contains a form, wait for the user's submission."}
    assert "fields" in json.loads(raw)["panel"]["blocks"][1]


@pytest.mark.parametrize("mode", ["ask", "auto", "off", "full"])
def test_panel_reaches_external_request_catalog_in_every_permission_mode(mode):
    import asyncio
    from models.inference import ChatCompletionRequest
    from routes.inference import _select_request_tools

    request = ChatCompletionRequest(
        model="nemotron-3.5-super-vl:free",
        messages=[{"role": "user", "content": "Muéstrame un formulario"}],
        enable_tools=True,
        enabled_tools=["generate_document", "propose_automation", "present_ui", "web_search"],
        permission_mode=mode,
    )
    selected = asyncio.run(_select_request_tools(request, tools_on=True, mcp_allowed=False))
    schema = next(tool["function"] for tool in selected if tool["function"]["name"] == "present_ui")
    assert schema["parameters"]["required"] == ["panel"]
    assert schema["parameters"]["properties"]["panel"]["properties"]["blocks"]
