import logging
import random
from html import unescape
from urllib.parse import urlparse, parse_qs, unquote

import httpx
from selectolax.parser import HTMLParser

logger = logging.getLogger("sparta_ai.tools.web_search_providers")

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
]

_DDG_URL = "https://html.duckduckgo.com/html/"


def _resolve_ddg_url(url: str) -> str:
    """Extract the real destination URL from a DuckDuckGo redirect wrapper."""
    if "duckduckgo.com/l/" in url and "uddg=" in url:
        parsed = urlparse(url)
        uddg = parse_qs(parsed.query).get("uddg", [None])[0]
        if uddg:
            return unquote(uddg)
    return url


def duckduckgo_search(query: str, count: int = 5, freshness: str | None = None) -> list[dict]:
    """Search via DuckDuckGo HTML endpoint. No API key required.

    Uses selectolax (fast HTML parser) instead of fragile regex patterns
    to extract search results. This eliminates the "cross-contamination"
    bug where regex would mix titles and snippets between adjacent results.

    Args:
        query: Search terms.
        count: Number of results (max 10).
        freshness: Time range filter. One of 'd' (day), 'w' (week),
            'm' (month), 'y' (year), or None for no filter.
    """
    headers = {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://duckduckgo.com/",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        data: dict[str, str] = {"q": query}
        if freshness:
            data["df"] = freshness
        resp = httpx.post(
            _DDG_URL,
            data=data,
            headers=headers,
            timeout=15.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("DuckDuckGo request failed: %s", e)
        return []

    text = resp.text

    # Detect CAPTCHA challenge
    if "captcha" in text.lower() or "challenge" in text.lower():
        logger.warning("DuckDuckGo returned a CAPTCHA challenge")
        return []

    # Parse HTML with selectolax parser (replaces all three regex patterns)
    tree = HTMLParser(text)
    results: list[dict] = []
    seen_urls: set[str] = set()

    # Primary selector: DDG HTML typically uses div.result wrappers
    for node in tree.css("div.result"):
        a = node.css_first("a.result__a")
        if not a:
            continue

        url = a.attributes.get("href", "").strip()
        url = _resolve_ddg_url(url)

        if not url.startswith("http") or url in seen_urls:
            continue
        seen_urls.add(url)

        title = a.text(strip=True)[:200]

        # Snippet can be in result__snippet (modern) or snippet (legacy)
        snippet_node = node.css_first(".result__snippet") or node.css_first(".snippet")
        snippet = snippet_node.text(strip=True)[:300] if snippet_node else ""

        results.append({
            "title": title or "Sin título",
            "url": url,
            "snippet": snippet or "",
        })

        if len(results) >= count:
            break

    # Fallback: try older DDG markup structure with result__title
    if len(results) < count:
        for node in tree.css("div.result"):
            a = node.css_first("a.result__title")
            if not a:
                continue

            url = a.attributes.get("href", "").strip()
            url = _resolve_ddg_url(url)

            if not url.startswith("http") or url in seen_urls:
                continue
            seen_urls.add(url)

            title = a.text(strip=True)[:200]
            snippet_node = node.css_first("div.snippet") or node.css_first(".result__snippet")
            snippet = snippet_node.text(strip=True)[:300] if snippet_node else ""

            results.append({
                "title": title or "Sin título",
                "url": url,
                "snippet": snippet or "",
            })

            if len(results) >= count:
                break

    # If we got zero results and the HTML doesn't look like a CAPTCHA,
    # raise RuntimeError so the caller can distinguish "0 results" from
    # "DDG changed their HTML markup".
    if len(results) == 0 and "result" not in text:
        raise RuntimeError(
            "DuckDuckGo HTML structure appears to have changed. "
            "No 'result' class elements found and no CAPTCHA detected. "
            "The selectolax parser needs to be updated."
        )

    return results