import assert from "node:assert/strict";
import test from "node:test";
import { resolvePreviewPath } from "../src/components/assistant-ui/sandbox-preview.ts";

test("preview dependencies keep their own directory and decode Unicode paths", () => {
  assert.equal(resolvePreviewPath("../images/a%20b.svg?v=2#icon", "css/styles.css"), "images/a b.svg");
  assert.equal(resolvePreviewPath("/styles.css", "pages/index.html"), "styles.css");
  assert.equal(resolvePreviewPath("main.js", "pages/index.html"), "pages/main.js");
});

test("preview bundling never loads external references through the authenticated loader", () => {
  for (const ref of ["https://example.com/x", "//example.com/x", "data:image/png;base64,abc", "#icon", "javascript:alert(1)"]) {
    assert.equal(resolvePreviewPath(ref, "index.html"), null);
  }
});

test("preview dependencies cannot escape the session root or use Windows paths", () => {
  for (const ref of ["../outside", "%2e%2e/outside", "dir/../../outside", "a\\b", "a%00b"]) {
    assert.throws(() => resolvePreviewPath(ref, "index.html"));
  }
});
