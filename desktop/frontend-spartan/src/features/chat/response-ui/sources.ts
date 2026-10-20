/** Fragments identify positions within the same evidence page. Query strings
 * remain significant (including document ids); never merge distinct documents. */
export function deduplicateSources<T extends { url: string }>(
  sources: T[],
): T[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    try {
      const url = new URL(source.url);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password)
        return false;
      url.hash = "";
      const key = url.href;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}
