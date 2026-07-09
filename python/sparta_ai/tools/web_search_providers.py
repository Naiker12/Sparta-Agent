import logging
import random
import re
from html import unescape
from urllib.parse import urlparse, parse_qs, unquote

import httpx

logger = logging.getLogger("sparta_ai.tools.web_search_providers")

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
]

_DDG_URL = "https://html.duckduckgo.com/html/"


def _clean_html(html: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", html)).strip()


def _resolve_ddg_url(url: str) -> str:
    """Extract the real destination URL from a DuckDuckGo redirect wrapper."""
    if "duckduckgo.com/l/" in url and "uddg=" in url:
        parsed = urlparse(url)
        uddg = parse_qs(parsed.query).get("uddg", [None])[0]
        if uddg:
            return unquote(uddg)
    return url


def duckduckgo_search(query: str, count: int = 5) -> list[dict]:
    """Search via DuckDuckGo HTML endpoint. No API key required."""
    headers = {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://duckduckgo.com/",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        resp = httpx.post(
            _DDG_URL,
            data={"q": query},
            headers=headers,
            timeout=15.0,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("DuckDuckGo request failed: %s", e)
        return []

    text = resp.text

    if "captcha" in text.lower() or "challenge" in text.lower():
        logger.warning("DuckDuckGo returned a CAPTCHA challenge")
        return []

    results: list[dict] = []
    seen_urls: set[str] = set()

    # Pattern 1: Modern DDG HTML (result__a + result__snippet)
    pattern1 = re.compile(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
        r'class="result__snippet"[^>]*>(.*?)</a>',
        re.DOTALL,
    )

    # Pattern 2: Alternative DDG HTML (result__title + result__snippet)
    pattern2 = re.compile(
        r'class="result__title"[^>]*>.*?href="([^"]+)"[^>]*>(.*?)</a>.*?'
        r'class="result__snippet"[^>]*>(.*?)</(?:a|span|div)',
        re.DOTALL,
    )

    # Pattern 3: Links with article heading (fallback)
    pattern3 = re.compile(
        r'<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        re.DOTALL,
    )

    for pattern in (pattern1, pattern2):
        for url, title, snippet in pattern.findall(text):
            url = url.strip()
            url = _resolve_ddg_url(url)
            if url in seen_urls:
                continue
            seen_urls.add(url)
            title_clean = _clean_html(title)[:200]
            snippet_clean = _clean_html(snippet)[:300]
            if title_clean and url.startswith("http"):
                results.append({
                    "title": title_clean,
                    "url": url,
                    "snippet": snippet_clean,
                })
            if len(results) >= count:
                return results

    # Pattern 3 fallback: extract from generic result links
    if len(results) < count:
        for match in pattern3.finditer(text):
            url = match.group(1).strip()
            url = _resolve_ddg_url(url)
            if url in seen_urls or not url.startswith("http"):
                continue
            seen_urls.add(url)
            title_clean = _clean_html(match.group(2))[:200]
            if title_clean:
                results.append({
                    "title": title_clean,
                    "url": url,
                    "snippet": "",
                })
            if len(results) >= count:
                return results

    return results
