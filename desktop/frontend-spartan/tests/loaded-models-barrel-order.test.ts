// Keep preference exports first and keep the reset tab independent of the indicator/settings cycle.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const BARREL = read("../src/features/loaded-models/index.ts");
const GENERAL_TAB = read("../src/features/settings/tabs/general-tab.tsx");
const INDICATOR = read(
  "../src/features/loaded-models/loaded-models-indicator.tsx",
);

test("the preference module is exported before the indicator", () => {
  const pref = BARREL.indexOf("./show-loaded-models-pref");
  const indicator = BARREL.indexOf("./loaded-models-indicator");
  assert.ok(pref !== -1 && indicator !== -1, "expected both exports");
  assert.ok(
    pref < indicator,
    "show-loaded-models-pref must be evaluated first, or general-tab reads the keys in the temporal dead zone",
  );
});

test("the reset reads preference keys directly without the indicator import cycle", () => {
  // The direct preference import avoids re-entering the indicator via the barrel.
  assert.match(INDICATOR, /from "@\/features\/settings"/);
  assert.match(GENERAL_TAB, /from "@\/features\/loaded-models\/show-loaded-models-pref"/);
  assert.doesNotMatch(GENERAL_TAB, /from "@\/features\/loaded-models"/);
  assert.match(GENERAL_TAB, /Object\.values\(LOADED_MODELS_PREFERENCE_KEYS\)/);
});

test("general-tab reads the keys at module scope, not inside a component", () => {
  // The reset list is evaluated at module scope; the preference module must already be initialized.
  const keysAt = GENERAL_TAB.indexOf("Object.values(LOADED_MODELS_PREFERENCE_KEYS)");
  const firstComponent = GENERAL_TAB.search(/\nexport function |\nfunction \w+\(/);
  assert.ok(keysAt !== -1, "expected the reset list to name the keys");
  assert.ok(
    firstComponent === -1 || keysAt < firstComponent,
    "the keys are read at module scope, so evaluation order decides the outcome",
  );
});
