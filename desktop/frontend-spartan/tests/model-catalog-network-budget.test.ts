
// The network catalog check promises that an unreachable Hub produces warnings, never a red run.
// Bounding each request is not enough to keep that promise: the batches are serial, so a peer
// that stalls every one of them can still outlive the workflow's own timeout and be killed --
// which is the red run, arriving by a different route. This pins the arithmetic.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CHECK = fileURLToPath(
  new URL(
    "../src/features/model-picker/components/model-selector/model-catalog.check.ts",
    import.meta.url,
  ),
);
test("the whole network pass is bounded, not just each request", () => {
  const source = readFileSync(CHECK, "utf8");
  assert.match(
    source,
    /Date\.now\(\) >= networkDeadlineAt/,
    "fetchWithRetry must short-circuit once the overall budget is spent",
  );
  assert.match(
    source,
    /networkDeadlineAt = Date\.now\(\) \+ NETWORK_DEADLINE_MS/,
    "the deadline has to be armed when the network pass starts",
  );
});
