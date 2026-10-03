import { expect, test } from "vitest";
import { saveReasoningCatalog } from "../desktop/frontend-spartan/src/features/chat/catalog-reasoning";
import { getExternalReasoningCapabilities } from "../desktop/frontend-spartan/src/features/chat/provider-capabilities";

test("shows only the efforts declared by a model, including maximum", () => {
  saveReasoningCatalog("openrouter", [{ id: "test/max", display_name: "Max", reasoning: { supported_efforts: ["max", "high", "low"], mandatory: true } }]);
  const caps = getExternalReasoningCapabilities("openrouter", "test/max");
  expect(caps.reasoningEffortLevels).toEqual(["low", "high", "max"]);
  expect(caps.reasoningStyle).toBe("reasoning_effort");
  expect(caps.supportsReasoningOff).toBe(false);
});

test("does not invent maximum for a model with only low and high", () => {
  saveReasoningCatalog("openrouter", [{ id: "test/limited", display_name: "Limited", reasoning: { supported_efforts: ["low", "high"] } }]);
  expect(getExternalReasoningCapabilities("openrouter", "test/limited").reasoningEffortLevels).toEqual(["low", "high"]);
});

test("non-reasoning catalog models do not expose reasoning controls", () => {
  saveReasoningCatalog("openrouter", [{ id: "test/plain", display_name: "Plain", reasoning: null }]);
  expect(getExternalReasoningCapabilities("openrouter", "test/plain").supportsReasoning).toBe(false);
});

test("null supported efforts allows gateway levels while respecting mandatory reasoning", () => {
  saveReasoningCatalog("openrouter", [{ id: "test/all", display_name: "All", reasoning: { supported_efforts: null, mandatory: true } }]);
  const caps = getExternalReasoningCapabilities("openrouter", "test/all");
  expect(caps.reasoningEffortLevels).toContain("max");
  expect(caps.reasoningEffortLevels).not.toContain("none");
});
