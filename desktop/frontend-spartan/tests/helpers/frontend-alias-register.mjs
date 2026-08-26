import { register } from "node:module";
import { readFileSync } from "node:fs";

// Vite replaces this at build time. Node's test runner needs the same fallback.
globalThis.__SPARTA_VERSION__ = JSON.parse(
  readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
).version;
register("./frontend-alias-resolver.mjs", import.meta.url);
