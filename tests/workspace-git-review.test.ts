import { afterEach, expect, test } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readGitReview, readGitReviewDiff, readGithubPullRequests } from "../desktop/ia-sparta-ipc-bridge/src/lib/workspace-git-review";
const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("sparta-git-review-")) throw new Error("Unexpected test directory");
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sparta-git-review-")); roots.push(root);
  const git = (args: string[]) => exec("git", ["-C", root, ...args], { windowsHide: true });
  await git(["init", "-b", "main"]); await git(["config", "user.name", "Test"]); await git(["config", "user.email", "test@example.test"]);
  return { root, git };
}
test("reviews local, staged and untracked files without changing the worktree", async () => {
  const { root, git } = await fixture();
  await fs.writeFile(path.join(root, "code file.ts"), "const value = 1;\n"); await git(["add", "."]); await git(["commit", "-m", "initial"]);
  await fs.writeFile(path.join(root, "code file.ts"), "const value = 2;\nconst extra = true;\n");
  await fs.writeFile(path.join(root, "new file.py"), "print('new')\n");
  const before = (await git(["status", "--porcelain"])).stdout;
  const snapshot = await readGitReview(root, "working");
  expect(snapshot.files.find(file => file.path === "code file.ts")).toMatchObject({ additions: 2, deletions: 1 });
  expect(snapshot.files.find(file => file.path === "new file.py")).toMatchObject({ additions: 1, deletions: 0 });
  expect(await readGitReviewDiff(root, "new file.py", "working")).toContain("+print('new')");
  expect((await readGitReview(root, "staged")).files).toEqual([]);
  expect((await git(["status", "--porcelain"])).stdout).toBe(before);
  await git(["add", "code file.ts"]);
  expect((await readGitReview(root, "staged")).files).toHaveLength(1);
  expect(await readGitReviewDiff(root, "code file.ts", "staged")).toContain("-const value = 1;");
});
test("compares a branch with its actual upstream and returns real history", async () => {
  const { root, git } = await fixture(); await fs.writeFile(path.join(root, "a.ts"), "one\n");
  await git(["add", "."]); await git(["commit", "-m", "first"]); await git(["branch", "baseline"]);
  await git(["branch", "--set-upstream-to=baseline", "main"]);
  await fs.writeFile(path.join(root, "a.ts"), "two\n"); await git(["commit", "-am", "second"]);
  await git(["remote", "add", "origin", "git@github.com:owner/repository.git"]);
  const review = await readGitReview(root, "branch");
  expect(review.repository).toBe("owner/repository"); expect(review.commits[0].subject).toBe("second");
  expect(review.files[0]).toMatchObject({ path: "a.ts", additions: 1, deletions: 1 });
  expect(await readGitReviewDiff(root, "a.ts", "branch")).toContain("+two");
});
test("rejects paths outside the connected root and invalid modes", async () => {
  const { root } = await fixture();
  await expect(readGitReviewDiff(root, "../private.txt", "working")).rejects.toThrow("outside");
  await expect(readGitReview(root, "invalid" as "working")).rejects.toThrow("Invalid review");
  await expect(readGithubPullRequests("--repo attacker")).rejects.toThrow("Invalid GitHub");
});
test("handles a new repository without a commit", async () => {
  const { root, git } = await fixture(); await fs.writeFile(path.join(root, "new.ts"), "hello\n");
  expect((await readGitReview(root, "working")).files[0]).toMatchObject({ path: "new.ts", additions: 1 });
  expect(await readGitReviewDiff(root, "new.ts", "working")).toContain("+hello");
  await git(["add", "."]);
  await fs.writeFile(path.join(root, "new.ts"), "hello\nnew content\n");
  expect((await readGitReview(root, "working")).files[0].additions).toBe(2);
  expect(await readGitReviewDiff(root, "new.ts", "working")).toContain("+new content");
  expect((await readGitReview(root, "staged")).files[0].additions).toBe(1);
});

test("a connected subdirectory only exposes changes inside that folder", async () => {
  const { root, git } = await fixture();
  const folder = path.join(root, "subfolder"); await fs.mkdir(folder);
  await fs.writeFile(path.join(folder, "a.ts"), "before\n");
  await fs.writeFile(path.join(root, "outside.ts"), "before\n");
  await git(["add", "."]); await git(["commit", "-m", "initial"]);
  await fs.writeFile(path.join(folder, "a.ts"), "after\n");
  await fs.writeFile(path.join(root, "outside.ts"), "after\n");
  expect((await readGitReview(folder, "working")).files.map(file => file.path)).toEqual(["a.ts"]);
  expect(await readGitReviewDiff(folder, "a.ts", "working")).toContain("+after");
});
