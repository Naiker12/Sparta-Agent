import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const audioSource = readFileSync(
  new URL("../src/features/audio/audio-page.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("an Audio task-only intent selects its mode and retains a refused switch for retry", () => {
  assert.match(audioSource, /const task = routeSearch\.task;\s*if \(!task\) \{\s*return;\s*\}\s*const intended =\s*task === "automatic-speech-recognition" \? "transcribe" : "speak";/);
  assert.match(audioSource, /if \(intended !== mode && !transitionMode\(intended\)\) \{\s*return;\s*\}\s*void navigateSelf\(\{ to: "\/audio", search: \{\}, replace: true \}\);/);
});
