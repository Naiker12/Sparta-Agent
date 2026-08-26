
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadDesktopAppVersion } from "../src/features/settings/desktop-app-version.ts";

const packageVersion = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
).version as string;

test("loads the Electron version displayed by About", async () => {
  Object.defineProperty(globalThis, "window", {
    value: { electronAPI: { getVersion: () => Promise.resolve("1.8.3") } },
    configurable: true,
  });
  assert.equal(
    await loadDesktopAppVersion(),
    "1.8.3",
  );
});

test("falls back to the build version when Electron IPC rejects", async () => {
  Object.defineProperty(globalThis, "window", {
    value: { electronAPI: { getVersion: () => Promise.reject(new Error("Electron IPC unavailable")) } },
    configurable: true,
  });
  const version = await loadDesktopAppVersion();

  assert.equal(version, packageVersion);
});
