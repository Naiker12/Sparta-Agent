import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { frontendDependencyCacheKey } from "../scripts/frontend-dependency-cache.mjs";

test("nested dependency upgrades change the root optimizer cache", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "sparta-cache-test-"));
  try {
    const lock = path.join(directory, "package-lock.json");
    writeFileSync(lock, JSON.stringify({ tap: "0.5.10" }));
    const oldKey = frontendDependencyCacheKey(lock);
    assert.equal(frontendDependencyCacheKey(lock), oldKey);
    writeFileSync(lock, JSON.stringify({ tap: "0.9.22" }));
    assert.notEqual(frontendDependencyCacheKey(lock), oldKey);
    assert.match(frontendDependencyCacheKey(), /^[a-f0-9]{16}$/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
