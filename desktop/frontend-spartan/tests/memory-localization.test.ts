import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "../src/i18n/locale-store.ts";
import { memoryTypeLabel } from "../src/features/memory/memory-types.ts";
import { translateMemory } from "../src/features/memory/memory-i18n.ts";
test("the independent graph follows both languages and preserves unknown types", async () => {
  await setLocale("es"); assert.equal(memoryTypeLabel("fact"), "Hecho");
  assert.match(translateMemory("ui.could_not_load_memory_http_value0", { value0: 503 }), /503/);
  await setLocale("en"); assert.equal(memoryTypeLabel("fact"), "Fact");
  assert.equal(memoryTypeLabel("custom_type"), "custom_type");
  assert.match(translateMemory("ui.could_not_load_memory_http_value0", { value0: 503 }), /Could not load memory/);
});
