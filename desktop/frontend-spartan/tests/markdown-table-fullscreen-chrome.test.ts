import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("fullscreen Markdown tables keep their close toolbar below desktop chrome", async () => {
  const stylesheet = await readFile(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(
    stylesheet,
    /\[data-streamdown="table-fullscreen"\][\s\S]*?padding-top:\s*var\(--studio-window-chrome-top,\s*0px\)/,
    "the Streamdown close button would be hidden beneath Electron's titlebar",
  );
});
