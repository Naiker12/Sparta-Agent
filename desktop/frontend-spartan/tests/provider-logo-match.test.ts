import assert from "node:assert/strict";
import test from "node:test";

import { matchProviderLogo } from "../src/features/hub/lib/provider-logos.ts";

test("an Unsloth DeepSeek re-upload resolves the original provider logo", () => {
  const provider = matchProviderLogo(
    "unsloth/DeepSeek-V4-Flash-Vision-Exp-GGUF",
  );
  assert.ok(provider);
  assert.equal(provider.name, "DeepSeek");
  assert.equal(provider.logoPath, "/hub/profile/logo/deepseek.svg");
});
