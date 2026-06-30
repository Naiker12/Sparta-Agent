import tempfile
from pathlib import Path

import pytest

from sparta_ai.tools.file_tools import read_file_tool, write_file_tool
from sparta_ai.tools.mcp_bridge import MCPToolWrapper, build_mcp_tools
from sparta_ai.tools.web_search import web_search_tool


class TestFileTools:
    def test_write_and_read_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            test_path = Path(tmpdir) / "test.txt"
            result = write_file_tool.invoke({"path": str(test_path), "content": "Hello, Sparta!"})
            assert "Archivo escrito" in result or "written to" in result
            assert test_path.exists()

            content = read_file_tool.invoke({"path": str(test_path)})
            assert content == "Hello, Sparta!"

    def test_read_nonexistent_file(self):
        result = read_file_tool.invoke({"path": "/nonexistent/path/file.txt"})
        assert "Error" in result

    def test_write_append(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            test_path = Path(tmpdir) / "append.txt"
            write_file_tool.invoke({"path": str(test_path), "content": "Line 1\n"})
            write_file_tool.invoke({"path": str(test_path), "content": "Line 2\n", "append": True})
            content = read_file_tool.invoke({"path": str(test_path)})
            assert "Line 1" in content
            assert "Line 2" in content


class TestWebSearchTool:
    @pytest.fixture(autouse=True)
    def _disable_brave(self, monkeypatch):
        monkeypatch.setattr("sparta_ai.config.security.get_key", lambda key: "")

    @pytest.mark.asyncio
    async def test_search_no_key(self, monkeypatch):
        def _fake_duckduckgo_search(query: str, count: int) -> list[dict]:
            return [
                {
                    "title": f"Result for {query}",
                    "url": "https://example.com",
                    "snippet": "A fake snippet",
                }
            ]

        monkeypatch.setattr("sparta_ai.tools.web_search.duckduckgo_search", _fake_duckduckgo_search)
        result = await web_search_tool.ainvoke({"query": "test", "count": 1})
        assert isinstance(result, str)
        assert "Resultados de búsqueda" in result
        assert "A fake snippet" in result

    @pytest.mark.asyncio
    async def test_search_no_results(self, monkeypatch):
        monkeypatch.setattr("sparta_ai.tools.web_search.duckduckgo_search", lambda q, c: [])
        result = await web_search_tool.ainvoke({"query": "xyzxyzxyz", "count": 1})
        assert isinstance(result, str)
        assert "No se encontraron resultados" in result


class TestMCPBridge:
    def test_build_mcp_tools_empty(self):
        assert build_mcp_tools([]) == []

    def test_build_mcp_tools_with_servers(self):
        servers = [
            {
                "id": "server1",
                "name": "Test Server",
                "tools": [
                    {"name": "tool_a", "description": "Tool A", "inputSchema": {}},
                    {"name": "tool_b", "description": "Tool B", "inputSchema": {}},
                ],
            }
        ]
        tools = build_mcp_tools(servers)
        assert len(tools) == 2
        assert all(isinstance(t, MCPToolWrapper) for t in tools)
        assert tools[0].name == "tool_a"
        assert tools[1].name == "tool_b"

    def test_mcp_tool_invoke(self):
        tool = MCPToolWrapper(name="test", description="Test", input_schema={}, server_id="srv1")
        result = tool.invoke({"key": "value"})
        assert "test" in result
        assert "srv1" in result
