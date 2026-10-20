import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Root Vite does not automatically include the nested frontend lockfile in its
// optimizer hash. Version its cache explicitly so upgrades cannot serve old
// assistant-ui exports alongside new source imports.
export function frontendDependencyCacheKey(lockfile = new URL("../desktop/frontend-spartan/package-lock.json", import.meta.url)) {
  return createHash("sha256").update(readFileSync(lockfile)).digest("hex").slice(0, 16);
}
