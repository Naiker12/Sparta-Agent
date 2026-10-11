// Native folder linking needs both backend support and a lease usable by this app.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HOOK = readFileSync(
  fileURLToPath(
    new URL("../src/features/rag/components/use-linked-folders.ts", import.meta.url),
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const MANAGER = readFileSync(
  fileURLToPath(
    new URL("../src/features/rag/components/linked-folders-manager.tsx", import.meta.url),
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const READINESS = readFileSync(
  fileURLToPath(
    new URL("../src/features/native-intents/use-native-readiness.ts", import.meta.url),
  ),
  "utf8",
).replace(/\r\n/g, "\n");

test("the picker is gated on the backend capability, not on isTauri alone", () => {
  assert.match(
    HOOK,
    /desktopSupported:\s*isTauri\s*&&\s*nativePathLeasesSupported/,
    "desktopSupported must require the lease capability as well as Tauri",
  );
  assert.ok(
    HOOK.includes("useNativePathLeasesSupported()"),
    "the capability must come from the shared readiness hook, not a local fetch",
  );
});

test("link() refuses without the capability, not just the button", () => {
  const body = HOOK.slice(
    HOOK.indexOf("const link = useCallback("),
    HOOK.indexOf("const run = useCallback("),
  );
  assert.ok(body.length > 0, "link() should still exist");
  assert.match(
    body,
    /if \(!\(scopeType && scopeId && isTauri && nativePathLeasesSupported\)\) \{\s*return/,
    "link() must bail before pickNativeDocumentFolder when leases are unsupported",
  );
  // A stale closure would restore the old behaviour once the capability flips.
  assert.ok(
    body.includes("nativePathLeasesSupported") &&
      HOOK.slice(HOOK.indexOf("const link = useCallback("))
        .includes("nativePathLeasesSupported,"),
    "nativePathLeasesSupported must be in link()'s dependency list",
  );
});

test("the unsupported branch names the managed backend, not the desktop app", () => {
  // The old copy told a desktop user to use the desktop app they were already in.
  assert.ok(
    !MANAGER.includes("link new folders in the desktop app"),
    "the unsupported copy must not tell a desktop user to use the desktop app",
  );
  assert.ok(
    MANAGER.includes('t("projectsPage.linkedFoldersDesktopDescription")') && MANAGER.includes('t("projectsPage.desktopBackendRequired")'),
    "the unsupported copy and tooltip should name the managed backend",
  );
});

test("the capability is read from /api/health and only latches on true", () => {
  assert.match(
    READINESS,
    /native_path_leases_supported\s*!==\s*true/,
    "an absent field on an older backend must not read as supported",
  );
  assert.ok(
    READINESS.includes("useState(false)"),
    "the hook must start unsupported, so the picker is never live before it is known",
  );
});

test("the health bit alone does not enable the picker inside the app", () => {
  // A survivor adopted from a dead previous app holds a lease key of its own, so
  // it answers true while every grant this app signs fails on the signature.
  assert.ok(
    READINESS.includes("native_path_leases_usable"),
    "the hook must also ask the app whether the live backend is one it spawned",
  );
  const gate = READINESS.slice(READINESS.indexOf("native_path_leases_usable"));
  assert.match(
    gate,
    /if\s*\(usable\)\s*\{\s*setSupported\(true\)/,
    "setSupported must be reached only when the app confirms the backend is ours",
  );
});
