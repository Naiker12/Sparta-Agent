import logging
import re
from html import unescape

import httpx

logger = logging.getLogger("sparta_ai.tools.web_search_providers")


def duckduckgo_search(query: str, count: int = 5) -> list[dict]:
    """Search via DuckDuckGo HTML endpoint. Sync, no API key required."""
    resp = httpx.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query},
        headers={"User-Agent": "Mozilla/5.0 (compatible; SpartaAgent/1.0)"},
        timeout=15.0,
    )
    resp.raise_for_status()

    results: list[dict] = []
    pattern = re.compile(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
        r'class="result__snippet"[^>]*>(.*?)</a>',
        re.DOTALL,
    )
    for url, title, snippet in pattern.findall(resp.text)[:count]:
        results.append({
            "title": unescape(re.sub("<[^>]+>", "", title)).strip(),
            "url": url,
            "snippet": unescape(re.sub("<[^>]+>", "", snippet)).strip(),
        })
    return results
