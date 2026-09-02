import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/features/hub/catalog/use-gguf-variant-fetch-state.ts", import.meta.url),
  "utf8",
);

test("a variants API timeout becomes an error instead of leaving the spinner active", () => {
  assert.match(source, /if \(controller\.signal\.aborted\) return;/);
  assert.doesNotMatch(source, /controller\.signal\.aborted \|\| isAbortError/);
  assert.match(source, /loading: false,/);
  assert.match(source, /refreshError: hasUsableVariants \? message : null/);
});
