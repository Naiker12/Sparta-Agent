import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = root + "desktop/frontend-spartan/";
const requireFrontend = createRequire(frontend + "package.json");
const { createServer } = await import(pathToFileURL(requireFrontend.resolve("vite")).href);
const server = await createServer({ root: frontend, configFile: frontend + "vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/files-panel-harness.html", { timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.pendingGitDiffs?.["src/a.ts"]));

  // Initial refresh selects and requests the first diff. Resolve B first, then A;
  // the older initial response must never replace the current selection.
  await page.getByRole("button", { name: /src\/b\.ts/ }).click();
  await page.waitForFunction(() => Boolean(window.pendingGitDiffs?.["src/b.ts"]));
  await page.evaluate(() => window.resolveGitDiff("src/b.ts", {
    success: true,
    diff: "diff --git a/src/b.ts b/src/b.ts\n@@ -1 +1 @@\n-old B\n+current B",
  }));
  await page.waitForFunction(() => document.querySelector('[data-diff-file="src/b.ts"]')?.textContent.includes("current B"));
  await page.evaluate(() => window.resolveGitDiff("src/a.ts", {
    success: true,
    diff: "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old A\n+stale A",
  }));
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-diff-file="src/a.ts"]').count(), 0);
  assert.equal(await page.locator('[data-diff-file="src/b.ts"]').count(), 1);
  assert.equal(await page.getByText("stale A", { exact: true }).count(), 0);

  await page.getByRole("button", { name: /src\/c\.ts/ }).click();
  await page.waitForFunction(() => Boolean(window.pendingGitDiffs?.["src/c.ts"]));
  await page.evaluate(() => window.resolveGitDiff("src/c.ts", {
    success: false,
    error: "Fixture permission denied",
  }));
  await page.getByRole("alert").getByText("Fixture permission denied", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-diff-file="src/c.ts"]').count(), 0);

  await page.evaluate(() => window.showFilesExplorer());
  await page.getByRole("button", { name: "index.html", exact: true }).waitFor();
  await page.getByRole("button", { name: "index.html", exact: true }).click();
  await page.waitForFunction(() => window.getFilesPreview()?.filename === "C:\\fixture\\index.html");
  const htmlPreview = await page.evaluate(() => window.getFilesPreview());
  assert.equal(htmlPreview.kind, "html");
  assert.match(htmlPreview.previewCode, /Workspace page/);
  assert.match(htmlPreview.previewCode, /color: rgb\(12, 34, 56\)/);
  assert.equal(await page.evaluate(() => window.previewResourcePaths.includes("C:\\fixture\\style.css")), true);
  assert.equal(htmlPreview.workspaceSource.projectId, "files-panel-fixture");

  await page.getByRole("button", { name: "external.html", exact: true }).click();
  await page.waitForFunction(() => window.getFilesPreview()?.filename === "C:\\fixture\\external.html");
  const linkedHtml = await page.evaluate(() => window.getFilesPreview());
  assert.equal(linkedHtml.kind, "html", "linked workspace resources should be bundled for the isolated preview");
  assert.match(linkedHtml.previewCode, /color: rgb\(12, 34, 56\)/);

  await page.getByRole("button", { name: "module.html", exact: true }).click();
  await page.waitForFunction(() => window.getFilesPreview()?.filename === "C:\\fixture\\module.html");
  const moduleHtml = await page.evaluate(() => window.getFilesPreview());
  assert.equal(moduleHtml.kind, "code", "unsupported project modules must stay as source code");
  assert.equal(moduleHtml.previewCode, undefined);

  await page.getByRole("button", { name: "report.pdf", exact: true }).click();
  await page.waitForFunction(() => window.getFilesPreview()?.filename === "C:\\fixture\\report.pdf");
  const pdfPreview = await page.evaluate(() => window.getFilesPreview());
  assert.equal(pdfPreview.kind, "pdf");
  assert.deepEqual(await page.evaluate(() => window.getFilesPreviewBytes()), [37, 80, 68, 70]);

  assert.deepEqual(errors, []);
  console.log("Files panel: race-safe Git diffs, connected source HTML, PDF bytes and shared preview routing passed.");
} finally {
  await browser?.close();
  await server?.close();
}
