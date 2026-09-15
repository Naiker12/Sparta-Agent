const LEADING_SLASH = /^\//;

/** Resolve a public asset against Vite's configured deployment base. */
export function publicAssetUrl(path: string): string {
  return encodeURI(import.meta.env.BASE_URL + path.replace(LEADING_SLASH, ""));
}
