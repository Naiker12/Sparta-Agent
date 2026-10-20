import { readFileSync } from "node:fs";

// Kept as the existing install/dev/build entry point. tap 0.9.22 includes
// upstream replay handling; do not apply the old 0.5.10 source rewrite.
const packageDir = new URL("../desktop/frontend-spartan/node_modules/@assistant-ui/tap/", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", packageDir), "utf8"));
if (version !== "0.9.22") throw new Error(`Review the tap replay regression tests for version ${version}`);
