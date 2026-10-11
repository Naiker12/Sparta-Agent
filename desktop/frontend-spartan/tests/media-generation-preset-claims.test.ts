// Shared preset ownership and write sequencing, independent of retired media pages.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function read(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const HOOK = read(
  "../src/features/generation-presets/use-media-generation-presets.ts",
);

test("the form claim counter is readable, so a pick can tell it was superseded", () => {
  assert.match(HOOK, /const formClaimId = useCallback\(\(\) => formClaim\.current, \[\]\);/);
  assert.match(HOOK, /^\s+formClaimId,$/m, "and returned from the hook");
});

test("a preset write that failed gives its form claim back", () => {
  // Otherwise a rejected save reads as "something newer owns the form" for the rest of the
  // session, and a pending pick's model defaults are skipped over a change that never happened.
  for (const name of ["const savePreset = useCallback(", "const deletePreset = useCallback("]) {
    const body = HOOK.slice(HOOK.indexOf(name));
    const failure = body.slice(body.indexOf("} catch (error) {"));
    assert.match(
      failure.slice(0, failure.indexOf("toast.error")),
      /if \(formClaim\.current === claim\) \{\s*formClaim\.current = previousClaim;\s*\}/,
      `${name} must restore the claim before reporting the failure`,
    );
  }
});

test("state writes go out one at a time, newest last", () => {
  // Two PUTs in flight land in whatever order the backend sees them, and the store keeps the last
  // one, so an older snapshot could outlive the newest recipe.
  assert.match(
    HOOK,
    /inflightWriteRef\.current = inflightWriteRef\.current\s*\n?\s*\.catch\(\(\) => undefined\)\s*\n?\s*\.then\(write\);/,
  );
  for (const site of [
    "saveMediaGenerationPresetSettings(kind, settings)",
    "saveMediaGenerationPresetSettings(kind, latest, true)",
  ]) {
    const at = HOOK.indexOf(site);
    assert.ok(at > 0, site);
    assert.match(
      HOOK.slice(at - 120, at),
      /queueWrite\(\(\) =>\s*$/,
      `${site} must go through the queue`,
    );
  }
});

test("a delete clears the selection even when a pick took the form meanwhile", () => {
  // The preset is gone either way, and a selection naming it leaves the control on a definition
  // that no longer exists (and persists that name on the next debounced write).
  const del = HOOK.slice(
    HOOK.indexOf("const deletePreset = useCallback("),
    HOOK.indexOf("const activeDefinition ="),
  );
  assert.match(
    del,
    /restoreDefaultAfterDelete\(paramsBeforeDelete, formClaim\.current === claim\);/,
  );
  const restore = HOOK.slice(
    HOOK.indexOf("const restoreDefaultAfterDelete = useCallback("),
    HOOK.indexOf("const deletePreset = useCallback("),
  );
  // Only the form VALUES are conditional; the selection reset is not.
  assert.match(restore, /ownsForm &&/);
  assert.match(restore, /setActivePreset\(DEFAULT_PRESET_NAME\);/);
});

test("a store with presets but no recipe still hydrates the library", () => {
  // saved:false means the recipe falls back to the model's defaults, not that the user's named
  // presets are gone; dropping them would hide a library the response is carrying.
  assert.match(
    HOOK,
    /hydrateLocalSettings\("fresh", settings\.customPresets \?\? \[\]\)/,
  );
  const hydrate = HOOK.slice(HOOK.indexOf("const hydrateLocalSettings = useCallback("));
  assert.match(hydrate.slice(0, hydrate.indexOf("setActivePreset")), /setCustomPresets\(custom\);/);
});
