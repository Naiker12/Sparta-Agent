import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(
    new URL(`../src/features/chat/${relativePath}`, import.meta.url),
    "utf8",
  );
}

test("all max-output cap callers pass the selected connection override", () => {
  const runtime = source("stores/chat-runtime-store.ts");
  const adapter = source("api/chat-adapter/stream-orchestrator.ts");

  assert.match(
    runtime,
    // inside the `if (provider)` guard, so no optional chain: an unresolved
    // provider must not clamp at all, rather than clamp to the fallback.
    /if \(provider\) \{[\s\S]*?getExternalMaxOutputTokens\([\s\S]*?provider\.maxOutputTokens/,
  );
  assert.match(
    adapter,
    /getExternalMaxOutputTokens\([\s\S]*?externalProvider\?\.maxOutputTokens/,
  );

  // re-gating this on the UI provider type makes the feature a no-op on the next sync
  assert.match(
    source("sync-external-providers.ts"),
    /maxOutputTokens: config\.max_output_tokens \?\? undefined,/,
  );
});

test("the connection editor exposes a bounded optional cap and warning", () => {
  const dialog = source("chat-providers-dialog.tsx");

  // Match the predicate, not the UI type: the `providerType === LEGACY_CUSTOM_PROVIDER_TYPE`
  // line is a display-name lookup and would still match with the gate gone.
  assert.match(
    dialog,
    /const supportsMaxOutputTokens = supportsProviderMaxOutputTokens\(/,
  );
  assert.match(dialog, /\{supportsMaxOutputTokens \? \(/);
  assert.match(dialog, /Max Tokens limit/);
  assert.match(
    dialog,
    /ui.caps_max_tokens_for_this_connection_never_raises_it_past_a_model_/,
  );
  assert.match(
    dialog,
    /ui.if_the_upstream_provider_does_not_support_this_value_requests_may/,
  );
  // A TEXT input: a `number` input sanitizes "131,072" to the empty string, which
  // means "no override" here and would silently CLEAR it on save. Bounds live in
  // `parseMaxOutputTokens` instead of in DOM attributes.
  assert.match(
    dialog,
    /id="provider-max-output-tokens"\s+type="text"\s+inputMode="numeric"/,
  );
  assert.doesNotMatch(
    dialog,
    /id="provider-max-output-tokens"\s+type="number"/,
  );
  // the floor is per provider, so Kimi's 16,000 outranks the generic 64
  assert.match(
    dialog,
    /const floor = Math\.max\(\s*PROVIDER_MAX_OUTPUT_TOKENS_MIN,\s*getExternalMinOutputTokens\(providerType\),\s*\);\s*if \(value < floor\)/,
  );
  assert.match(dialog, /Number\.isSafeInteger\(value\)/);
  assert.match(dialog, /\/\^\\d\+\$\/\.test\(trimmed\)/);

  // seeding the draft raw would wedge every edit of a row stored below the floor,
  // since the parse above throws on it and the field is submitted untouched
  assert.match(
    dialog,
    /setMaxOutputTokensDraft\(\s*provider\.maxOutputTokens == null\s*\? ""\s*: Math\.max\(\s*provider\.maxOutputTokens,\s*getExternalMinOutputTokens\(provider\.providerType\),\s*\)\.toString\(\),\s*\);/,
  );
});
