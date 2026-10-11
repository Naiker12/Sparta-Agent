// Download cancellation remains covered by the active download manager.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const DOWNLOAD_PANEL = read(
  "../src/features/hub/download-manager/download-manager-panel.tsx",
);

test("the download manager keeps its own, differently named cancel", () => {
  assert.match(DOWNLOAD_PANEL, /ui.cancel_download/);
});
