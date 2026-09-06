/** Only the configured renderer may request a managed desktop session. */
export function isDesktopAuthOrigin(frameUrl: string, rendererUrl: string): boolean {
  try {
    const frame = new URL(frameUrl);
    const renderer = new URL(rendererUrl);
    if (renderer.protocol === "file:") {
      return frame.protocol === "file:" && frame.host === renderer.host && frame.pathname === renderer.pathname;
    }
    return ["http:", "https:"].includes(renderer.protocol) && frame.origin === renderer.origin;
  } catch {
    return false;
  }
}
