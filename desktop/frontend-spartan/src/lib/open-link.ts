import { getAppLocation, usesFileRouting } from "./app-location";
import { isTauri } from "@/lib/api-base";

/**
 * Open a URL in the system browser (Tauri) or new tab (web). Handles anchor
 * and mailto: links natively. Returns true when the caller should
 * preventDefault; false to let native navigation proceed (relative, empty).
 */
export function openLink(url: string): boolean {
  if (!url) {
    return false;
  }

  // Anchor links scroll within the page, don't open externally
  if (url.startsWith("#")) {
    const route = getAppLocation();
    window.location.hash = usesFileRouting(window.location)
      ? `${route.pathname}${route.search}${url}`
      : url;
    return true;
  }

  // Relative URLs: let the browser / router handle them natively
  if (!(url.includes("://") || url.startsWith("mailto:"))) {
    return false;
  }

  if (isTauri) {
    import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
      openUrl(url).catch(console.error);
    });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
