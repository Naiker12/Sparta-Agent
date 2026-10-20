"""Validated display-only panels. Submitting a form is a new user message,
never permission to run an external operation or arbitrary code."""
import json
import math
import re

_ID = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,47}$")
_STRING = {"type": "string"}
_FIELD_SCHEMA = {"type": "object", "properties": {
    "id": _STRING, "label": _STRING,
    "type": {"type": "string", "enum": ["text", "textarea", "number", "select", "checkbox", "date"]},
    "required": {"type": "boolean"}, "options": {"type": "array", "items": _STRING, "maxItems": 20},
    "min": {"type": "number"}, "max": {"type": "number"},
}, "required": ["id", "label", "type"], "additionalProperties": False}
_PANEL_SCHEMA = {"type": "object", "properties": {
    "version": {"type": "integer", "enum": [1]}, "title": _STRING, "description": _STRING,
    "layout": {"type": "string", "enum": ["stack", "grid"]},
    "blocks": {"type": "array", "maxItems": 24, "items": {"type": "object", "properties": {
        "kind": {"type": "string", "enum": ["text", "heading", "metric", "table", "form"]},
        "text": _STRING, "label": _STRING, "value": _STRING, "title": _STRING, "id": _STRING,
        "columns": {"type": "array", "items": _STRING, "maxItems": 12},
        "rows": {"type": "array", "maxItems": 100, "items": {"type": "array", "items": _STRING}},
        "fields": {"type": "array", "maxItems": 12, "items": _FIELD_SCHEMA},
    }, "required": ["kind"], "additionalProperties": False}},
}, "required": ["version", "title", "blocks"], "additionalProperties": False}

PRESENT_UI_TOOL = {"type": "function", "function": {
    "name": "present_ui",
    "description": (
        "Present a custom panel or collect missing user input using native components. Display only: no scripts, HTML, URLs, commands, or external actions. "
        "Compose text/heading blocks with text, metric blocks with label/value strings, table blocks with columns/rows, or form blocks with id/title/fields. "
        "Panel version is 1; layout is stack or grid. Use stable unique form and field ids. At most two forms, twelve fields each. "
        "Select fields need options; numeric fields may have min/max. Never request passwords, API keys or other secrets. "
        "Forms send their values as a new user message. This tool never waits for a form submission and must not be polled. "
        "After success the complete panel is already visible in the chat. End with at most one short confirmation sentence. "
        "Do not reproduce the fields as Markdown, add a second summary/table, or explain how to use the form. Wait for the user's submission before summarizing their data."
    ),
    "parameters": {"type": "object", "properties": {"panel": _PANEL_SCHEMA}, "required": ["panel"], "additionalProperties": False},
}}


def _text(value, limit):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= limit


def _keys(value, allowed):
    return isinstance(value, dict) and not (set(value) - set(allowed))


def validate_panel(panel):
    if not _keys(panel, ("version", "title", "description", "layout", "blocks")) or type(panel.get("version")) is not int or panel["version"] != 1 or not _text(panel.get("title"), 120):
        raise ValueError("Invalid panel")
    if "description" in panel and not _text(panel["description"], 500): raise ValueError("Invalid description")
    if panel.get("layout", "stack") not in ("stack", "grid"): raise ValueError("Invalid layout")
    blocks = panel.get("blocks")
    if not isinstance(blocks, list) or not 1 <= len(blocks) <= 24: raise ValueError("Invalid blocks")
    forms = set()
    for block in blocks:
        if not isinstance(block, dict): raise ValueError("Invalid block")
        kind = block.get("kind")
        if kind in ("text", "heading"):
            if not _keys(block, ("kind", "text")) or not _text(block.get("text"), 4000 if kind == "text" else 120): raise ValueError("Invalid text")
        elif kind == "metric":
            if not _keys(block, ("kind", "label", "value")) or not _text(block.get("label"), 120) or not _text(block.get("value"), 200): raise ValueError("Invalid metric")
        elif kind == "table":
            columns, rows = block.get("columns"), block.get("rows")
            if not _keys(block, ("kind", "columns", "rows")) or not isinstance(columns, list) or not 2 <= len(columns) <= 12 or not all(isinstance(cell, str) and len(cell) <= 2000 for cell in columns): raise ValueError("Invalid columns")
            if not isinstance(rows, list) or not 1 <= len(rows) <= 100 or not all(isinstance(row, list) and len(row) == len(columns) and all(isinstance(cell, str) and len(cell) <= 2000 for cell in row) for row in rows): raise ValueError("Invalid rows")
        elif kind == "form":
            form_id, fields = block.get("id"), block.get("fields")
            if not _keys(block, ("kind", "id", "title", "fields")) or not isinstance(form_id, str) or not _ID.fullmatch(form_id) or form_id in forms or not _text(block.get("title"), 120) or not isinstance(fields, list) or not 1 <= len(fields) <= 12: raise ValueError("Invalid form")
            forms.add(form_id)
            if len(forms) > 2: raise ValueError("Too many forms")
            ids = set()
            for field in fields:
                if not _keys(field, ("id", "label", "type", "required", "options", "min", "max")): raise ValueError("Invalid field")
                field_id, field_type = field.get("id"), field.get("type")
                if not isinstance(field_id, str) or not _ID.fullmatch(field_id) or field_id in ids or not _text(field.get("label"), 120) or field_type not in ("text", "textarea", "number", "select", "checkbox", "date"): raise ValueError("Invalid field")
                ids.add(field_id)
                if "required" in field and type(field["required"]) is not bool: raise ValueError("Invalid requirement")
                if field_type == "select":
                    options = field.get("options")
                    if not isinstance(options, list) or not 1 <= len(options) <= 20 or not all(_text(option, 100) for option in options) or len(set(options)) != len(options): raise ValueError("Invalid options")
                elif "options" in field: raise ValueError("Unexpected options")
                for name in ("min", "max"):
                    if name in field and (field_type != "number" or type(field[name]) not in (int, float) or not math.isfinite(field[name]) or abs(field[name]) > 1e12): raise ValueError("Invalid numeric bound")
                if "min" in field and "max" in field and field["min"] > field["max"]: raise ValueError("Invalid numeric range")
        else: raise ValueError("Unknown component")
    if len(json.dumps(panel, ensure_ascii=False, allow_nan=False)) > 40000: raise ValueError("Panel too large")
    return panel


def panel_text(panel):
    lines = [panel["title"]]
    if panel.get("description"): lines.append(panel["description"])
    for block in panel["blocks"]:
        if block["kind"] in ("text", "heading"): lines.append(block["text"])
        elif block["kind"] == "metric": lines.append(f"{block['label']}: {block['value']}")
        elif block["kind"] == "table":
            lines.append(" | ".join(block["columns"]))
            lines.extend(" | ".join(row) for row in block["rows"])
        elif block["kind"] == "form":
            lines.append(block["title"])
            lines.extend(f"- {field['label']} ({field['type']})" + (": " + ", ".join(field["options"]) if field.get("options") else "") for field in block["fields"])
    return "\n\n".join(lines)


def present_ui(arguments):
    try:
        if not _keys(arguments, ("panel",)): raise ValueError("Invalid arguments")
        panel = validate_panel(arguments.get("panel"))
        return json.dumps({"kind": "response_panel", "panel": panel, "fallbackText": panel_text(panel)}, ensure_ascii=False)
    except (ValueError, TypeError, KeyError, RecursionError):
        return "Error: invalid panel. Use only the documented components and bounded fields; do not include code or actions."
