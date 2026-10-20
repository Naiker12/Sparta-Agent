"""Read-only image search. Return bounded evidence; never download image bytes."""

def search_reference_images(query, *, timeout=10, cancel_event=None, website_policy=None):
    from core.channels.images import parse_results
    from core.inference.web_access_policy import check_url_access, scope_search_query

    if not isinstance(query, str) or not query.strip() or len(query) > 500:
        return "Error: provide an image search query of at most 500 characters."
    if cancel_event is not None and cancel_event.is_set():
        return "Search cancelled."
    try:
        from ddgs import DDGS
        results = DDGS(timeout=min(timeout or 10, 15)).images(
            scope_search_query(query.strip(), website_policy), max_results=6, safesearch="on"
        )
        if cancel_event is not None and cancel_event.is_set():
            return "Search cancelled."
        # Apply site limits before the channel adapter's two-image cap, so
        # disallowed early hits cannot hide later usable evidence.
        permitted = [item for item in results[:12] if isinstance(item, dict) and
                     all(check_url_access(item.get(key), website_policy)[0] for key in ("url", "image"))] if isinstance(results, list) else []
        parts = []
        for image in parse_results(permitted):
            parts.append(
                f"Title: {image.title}\nURL: {image.url}\nImage_URL: {image.image_url}\n"
                "Snippet: Reference image metadata only. Pixels were not inspected; authorship and reuse license are not verified."
            )
        return "\n\n---\n\n".join(parts) if parts else "No usable reference images found."
    except Exception:
        # Search providers can include URLs or tokens in exception messages.
        return "Error: image search is unavailable. Do not invent image URLs."
