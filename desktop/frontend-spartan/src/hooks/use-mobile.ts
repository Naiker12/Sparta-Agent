
import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
// A right-side inspector needs room for the conversation as well as its own
// controls. Below this width it should overlay the workspace instead of
// squeezing the main area into an unusable strip.
const COMPACT_LAYOUT_BREAKPOINT = 1080;
const COMPACT_LAYOUT_MEDIA_QUERY = `(max-width: ${COMPACT_LAYOUT_BREAKPOINT - 1}px)`;

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function getCompactLayoutSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;
}

function subscribeCompactLayout(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** True when docked inspector panels would leave too little room for content. */
export function useIsCompactLayout(): boolean {
  return useSyncExternalStore(
    subscribeCompactLayout,
    getCompactLayoutSnapshot,
    () => false,
  );
}
