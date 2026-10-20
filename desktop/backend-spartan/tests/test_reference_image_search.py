import sys
from threading import Event
from types import SimpleNamespace

from core.inference.reference_images import search_reference_images


def install_search(monkeypatch, results):
    calls = []
    class Search:
        def __init__(self, **kwargs):
            calls.append(kwargs)
        def images(self, query, **kwargs):
            calls.append((query, kwargs))
            return results
    monkeypatch.setitem(sys.modules, "ddgs", SimpleNamespace(DDGS=Search))
    return calls


def image(url="https://example.org/article", image_url="https://images.example.org/photo.jpg"):
    return {"url": url, "image": image_url, "title": "A reference", "width": 100, "height": 100}


def test_returns_reference_evidence_without_fetching_images(monkeypatch):
    calls = install_search(monkeypatch, [image(), image()])
    result = search_reference_images("example", timeout=120)
    assert result.count("Image_URL:") == 1
    assert "URL: https://example.org/article" in result
    assert "Pixels were not inspected" in result
    assert calls[0] == {"timeout": 15}
    assert calls[1][1]["safesearch"] == "on"


def test_cancelled_or_invalid_queries_do_not_search(monkeypatch):
    calls = install_search(monkeypatch, [])
    cancelled = Event()
    cancelled.set()
    assert search_reference_images("example", cancel_event=cancelled) == "Search cancelled."
    assert search_reference_images("x" * 501).startswith("Error:")
    assert calls == []


def test_private_destinations_and_website_policy_apply_to_source_and_image(monkeypatch):
    install_search(monkeypatch, [image(image_url="http://127.0.0.1/secret"), image()])
    result = search_reference_images("example", website_policy={"allowedDomains": ["example.org"], "blockedDomains": ["images.example.org"]})
    assert result == "No usable reference images found."


def test_cancellation_after_network_discards_results(monkeypatch):
    cancelled = Event()
    class Search:
        def __init__(self, **kwargs): pass
        def images(self, *args, **kwargs):
            cancelled.set()
            return [image()]
    monkeypatch.setitem(sys.modules, "ddgs", SimpleNamespace(DDGS=Search))
    assert search_reference_images("example", cancel_event=cancelled) == "Search cancelled."


def test_failure_does_not_leak_provider_error_details(monkeypatch):
    class Search:
        def __init__(self, **kwargs):
            raise RuntimeError("private credential")
    monkeypatch.setitem(sys.modules, "ddgs", SimpleNamespace(DDGS=Search))
    result = search_reference_images("example")
    assert result.startswith("Error:")
    assert "private credential" not in result


def test_existing_web_tool_dispatches_image_mode_without_changing_web_mode(monkeypatch):
    from core.inference import tools
    calls = install_search(monkeypatch, [image()])
    result = tools.execute_tool("web_search", {"query": "example", "search_type": "images"})
    assert "Image_URL:" in result
    assert len(calls) == 2
    assert tools.execute_tool("web_search", {"query": "example", "url": "https://example.org", "search_type": "images"}).startswith("Error:")
    monkeypatch.setattr(tools, "_web_search", lambda query, **kwargs: f"web:{query}")
    assert tools.execute_tool("web_search", {"query": "example"}) == "web:example"


def test_disallowed_early_hits_do_not_hide_permitted_references(monkeypatch):
    install_search(monkeypatch, [image(image_url="https://blocked.org/1"), image(image_url="https://blocked.org/2"), image()])
    result = search_reference_images("example", website_policy={"allowedDomains": ["example.org"], "blockedDomains": []})
    assert "Image_URL: https://images.example.org/photo.jpg" in result
    assert "blocked.org" not in result
