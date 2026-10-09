import { useEffect, useState } from "react";

async function loadHighlighter() {
  const [{ createCodePlugin }, { spartanLightTheme, spartanDarkTheme }] = await Promise.all([
    import("./code-plugin"), import("./code-themes"),
  ]);
  const themes = [spartanLightTheme, spartanDarkTheme] as [typeof spartanLightTheme, typeof spartanDarkTheme];
  return { code: createCodePlugin({ themes }), themes };
}
type Highlighter = Awaited<ReturnType<typeof loadHighlighter>>;
let pending: Promise<Highlighter> | undefined;
function sharedHighlighter() {
  if (!pending) pending = loadHighlighter().catch((error) => { pending = undefined; throw error; });
  return pending;
}

/** Share one deferred plugin; plain source remains available on load failure. */
export function useLazyCodeHighlighter(enabled: boolean) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void sharedHighlighter().then((value) => {
      if (!cancelled) setHighlighter(value);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [enabled]);
  return highlighter;
}
