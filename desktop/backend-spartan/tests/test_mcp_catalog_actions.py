import json

from core.inference import mcp_server_actions


def test_search_catalog_returns_safe_github_template():
    result = json.loads(mcp_server_actions.search_catalog_for_model({"query": "github"}))
    match = next(item for item in result["matches"] if item["id"] == "github")
    assert match["name"] == "GitHub"
    assert "GITHUB_TOKEN" in match["env_required"]
    assert "headers" not in match


def test_search_catalog_requires_a_query():
    assert "query is required" in mcp_server_actions.search_catalog_for_model({})
