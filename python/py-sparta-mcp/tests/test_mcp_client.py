from sparta_tools.mcp_client import RealMCPClient


def test_npx_mcp_gets_cold_start_connect_timeout():
    client = RealMCPClient({"id": "filesystem", "command": "npx", "timeout": 30})
    assert client._connect_timeout == 30


def test_regular_mcp_keeps_fast_connect_timeout():
    client = RealMCPClient({"id": "local", "command": "uvx", "timeout": 30})
    assert client._connect_timeout == 10


def test_explicit_connect_timeout_wins():
    client = RealMCPClient({"id": "filesystem", "command": "npx", "connect_timeout": 45})
    assert client._connect_timeout == 45
