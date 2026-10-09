import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { isWithinRoot } from "../tools/path-guard";

const exec = promisify(execFile);
export type ReviewMode = "working" | "staged" | "branch";
const options = { windowsHide: true, timeout: 8_000, maxBuffer: 2 * 1024 * 1024 };
async function git(root: string, args: string[]) {
  return (await exec("git", ["-C", root, "--no-optional-locks", ...args], options)).stdout;
}
async function initialWorkingTree(root: string, mode: ReviewMode) {
  if (mode !== "working") return false;
  try { await git(root, ["rev-parse", "--verify", "HEAD"]); return false; }
  catch { return true; }
}
async function base(root: string, mode: ReviewMode) {
  if (!["working", "staged", "branch"].includes(mode)) throw new Error("Invalid review mode");
  if (mode === "branch") {
    const upstream = (await git(root, ["rev-parse", "--abbrev-ref", "@{upstream}"])).trim();
    return [(await git(root, ["merge-base", "HEAD", upstream])).trim(), "HEAD"];
  }
  if (mode === "staged") return ["--cached"];
  try { await git(root, ["rev-parse", "--verify", "HEAD"]); return ["HEAD"]; }
  catch { return ["--cached"]; }
}
export async function readGitReview(root: string, mode: ReviewMode) {
  const args = await base(root, mode);
  const initial = await initialWorkingTree(root, mode);
  const raw = await git(root, ["diff", "--relative", "--no-ext-diff", "--no-renames", "--numstat", "-z", ...args, "--"]);
  const files = raw.split("\0").filter(Boolean).map(entry => {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error("Invalid Git file statistics");
    return { path: match[3], additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0, binary: match[1] === "-" };
  });
  if (mode === "working") {
    if (initial) files.length = 0;
    const untracked = await git(root, ["ls-files", ...(initial ? ["--cached"] : []), "--others", "--exclude-standard", "-z"]);
    for (const filename of new Set(untracked.split("\0").filter(Boolean))) {
      let additions = 0, binary = false;
      const candidate = path.resolve(root, filename);
      if (isWithinRoot(candidate, root)) {
        try {
          if ((await fs.stat(candidate)).size <= 1024 * 1024) {
            const bytes = await fs.readFile(candidate);
            binary = bytes.includes(0);
            if (!binary && bytes.length) additions = bytes.toString("utf8").split(/\r?\n/).length - (bytes.at(-1) === 10 ? 1 : 0);
          }
        } catch { /* A file can disappear during the snapshot. */ }
      }
      files.push({ path: filename, additions, deletions: 0, binary });
    }
  }
  const history = await git(root, ["log", "-12", "--format=%h%x09%s%x09%an%x09%aI"]).catch(() => "");
  let remote = "";
  try { remote = (await git(root, ["remote", "get-url", "origin"])).trim(); } catch { /* Local repository. */ }
  // Return only a canonical public repository identity, never credential-bearing URLs.
  const match = /^(?:git@github\.com:|https:\/\/github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote);
  return {
    files, repository: match ? `${match[1]}/${match[2]}` : null,
    commits: history.split(/\r?\n/).filter(Boolean).map(line => {
      const [id, subject, author, date] = line.split("\t"); return { id, subject, author, date };
    }),
  };
}
export async function readGitReviewDiff(root: string, filename: string, mode: ReviewMode) {
  const candidate = path.resolve(root, filename);
  if (!filename || filename.includes("\0") || !isWithinRoot(candidate, root)) throw new Error("Path is outside workspace root");
  const args = await base(root, mode);
  const initial = await initialWorkingTree(root, mode);
  const diff = initial ? "" : await git(root, ["diff", "--relative", "--no-ext-diff", "--no-color", "--no-renames", "--unified=5", ...args, "--", filename]);
  if (diff || mode !== "working") return diff;
  // Git diff omits untracked files. Verify their status and resolve symlinks before reading.
  const untracked = await git(root, ["ls-files", ...(initial ? ["--cached"] : []), "--others", "--exclude-standard", "-z", "--", filename]);
  if (!untracked.split("\0").includes(filename)) return "";
  const real = await fs.realpath(candidate);
  // Resolve both with the same API: on Windows realpathSync can retain 8.3
  // aliases while promises.realpath expands them to the long directory name.
  const relative = path.relative(await fs.realpath(root), real);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Path is outside workspace root");
  if ((await fs.stat(real)).size > 1024 * 1024) return "";
  const bytes = await fs.readFile(real);
  if (bytes.includes(0)) return "";
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (!lines.length) return "";
  return `--- /dev/null\n+++ b/${filename}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}`).join("\n")}\n`;
}
export async function readGithubPullRequests(repository: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid GitHub repository");
  try {
    const { stdout } = await exec("gh", ["pr", "list", "--repo", repository, "--state", "all", "--limit", "30", "--json", "number,title,state,url,headRefName,baseRefName"], { ...options, timeout: 15_000 });
    return JSON.parse(stdout) as Array<{ number: number; title: string; state: string; url: string; headRefName: string; baseRefName: string }>;
  } catch {
    // Public repositories work without installing/authenticating GitHub CLI.
    // Private repositories use the existing gh session above.
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls?state=all&per_page=30`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Sparta-Agent" },
      signal: AbortSignal.timeout(15_000), redirect: "error",
    });
    if (!response.ok) throw new Error("github_unavailable");
    const items = await response.json() as Array<{ number: number; title: string; state: string; merged_at: string | null; head: { ref: string }; base: { ref: string } }>;
    return items.map(item => ({ number: item.number, title: item.title, state: item.merged_at ? "MERGED" : item.state.toUpperCase(), url: `https://github.com/${repository}/pull/${item.number}`, headRefName: item.head.ref, baseRefName: item.base.ref }));
  }
}
