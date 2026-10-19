/** File-based Electron windows keep their document path and route inside the hash. */
export function usesFileRouting(location: Pick<Location, "protocol">): boolean {
  return location.protocol === "file:";
}

export function getAppLocation(
  location: Pick<Location, "protocol" | "pathname" | "search" | "hash"> = window.location,
): URL {
  const route = usesFileRouting(location)
    ? location.hash.slice(1) || "/"
    : `${location.pathname}${location.search}${location.hash}`;
  return new URL(route, "https://sparta.invalid");
}

/** Full-page auth redirects must reload index.html, never a nonexistent /login file. */
export function appNavigationHref(target: string, location: Location = window.location): string {
  if (!usesFileRouting(location)) return target;
  const documentUrl = new URL(location.href);
  documentUrl.hash = target;
  return documentUrl.href;
}

/** Preserve the existing full-reload boundary when authentication clears session state. */
export function reloadAppAt(target: string, location: Location = window.location): void {
  location.href = appNavigationHref(target, location);
  if (usesFileRouting(location)) location.reload();
}
