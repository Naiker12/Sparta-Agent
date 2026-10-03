import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Backport the upstream concurrent reducer replay fix to the pinned tap API.
// https://github.com/assistant-ui/assistant-ui/pull/5331
// Remove this backport when upgrading assistant-ui to a release containing it.
const packageDir = new URL("../desktop/frontend-spartan/node_modules/@assistant-ui/tap/", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", packageDir), "utf8"));
if (version !== "0.5.10") throw new Error(`Review the tap replay backport for version ${version}`);

for (const relative of ["src/core/helpers/root.ts", "dist/core/helpers/root.js"]) {
  const path = fileURLToPath(new URL(relative, packageDir));
  let source = readFileSync(path, "utf8");
  if (source.includes("version <= root.committedVersion")) continue;
  if (!source.includes('throw new Error("Version is less than committed version")')) {
    throw new Error(`Unexpected tap root implementation: ${relative}`);
  }
  source = source.replace("version === root.committedVersion", "version <= root.committedVersion")
    .replace(/(if \(version <= root\.committedVersion\) \{)/, "$1\n      root.committedVersion = version;")
    .replace(/\s*if \(root\.committedVersion > version\)\s*throw new Error\("Version is less than committed version"\);/, "");
  writeFileSync(path, source);
}
