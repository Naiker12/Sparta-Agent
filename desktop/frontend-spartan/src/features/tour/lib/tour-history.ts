const seenThisSession = new Set<string>();

export const CHAT_TOUR_AUTO_KEY = "spartan:guided-tour:chat:first-visit";

export function hasSeenTour(key: string): boolean {
  if (seenThisSession.has(key)) return true;
  try { return Boolean(localStorage.getItem(key)); } catch { return false; }
}

export function rememberTour(key: string, state: "shown" | "skipped" | "done"): void {
  seenThisSession.add(key);
  try { localStorage.setItem(key, state); } catch { /* Still remembered in this session. */ }
}
