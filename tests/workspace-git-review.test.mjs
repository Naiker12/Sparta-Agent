import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "sparta-git-review-"));
const root = join(directory, "repo");
const requireFrontend = createRequire(new URL("../desktop/frontend-spartan/package.json", import.meta.url));
const esbuild = requireFrontend("esbuild");
const modulePath = join(directory, "workspace-git-review.mjs");
await esbuild.build({
  entryPoints: [fileURLToPath(new URL("../desktop/ia-sparta-ipc-bridge/src/lib/workspace-git-review.ts", import.meta.url))],
  outfile: modulePath, bundle: true, platform: "node", format: "esm",
});
const { readGitReview } = await import(pathToFileURL(modulePath).href);
execFileSync("git", ["init", "-q", root], { stdio: "ignore", windowsHide: true });
const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore", windowsHide: true });
try {
  git("config", "user.name", "Sparta Test");
  git("config", "user.email", "sparta-test@example.invalid");
  writeFileSync(join(root, "modified.txt"), "before\n");
  writeFileSync(join(root, "deleted.txt"), "remove me\n");
  writeFileSync(join(root, "tracked.bin"), Buffer.from([0, 1, 2]));
  git("add", "--", ".");
  git("commit", "-q", "-m", "initial");

  writeFileSync(join(root, "modified.txt"), "after\n");
  unlinkSync(join(root, "deleted.txt"));
  writeFileSync(join(root, "tracked.bin"), Buffer.from([0, 3, 4]));
  writeFileSync(join(root, "new.txt"), "new text\n");
  writeFileSync(join(root, "new.bin"), Buffer.from([0, 9]));

  const snapshot = await readGitReview(root, "working");
  const files = new Map(snapshot.files.map(file => [file.path, file]));
  assert.equal(files.get("modified.txt").status, "modified");
  assert.equal(files.get("deleted.txt").status, "deleted");
  assert.equal(files.get("new.txt").status, "added");
  assert.equal(files.get("new.bin").status, "added");
  assert.equal(files.get("tracked.bin").status, "modified");
  assert.equal(files.get("tracked.bin").binary, true);
  assert.equal(files.get("new.bin").binary, true);
  console.log("Git review bridge: added/modified/deleted and binary status passed.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
