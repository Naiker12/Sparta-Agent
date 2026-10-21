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
  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/workspace-file-tools.html", { timeout: 120_000 });

  const html = page.locator('[data-slot="tool-fallback-trigger"]').filter({ hasText: "calculator.html" });
  await html.click();
  await page.getByRole("button", { name: "Preview HTML", exact: true }).click();
  const htmlPreview = await page.evaluate(() => window.readWorkspacePreview());
  assert.equal(htmlPreview.kind, "html");
  assert.match(htmlPreview.previewCode, /Saved calculator/);

  const css = page.locator('[data-slot="tool-fallback-trigger"]').filter({ hasText: "styles.css" });
  await css.click();
  await page.getByRole("button", { name: "View source", exact: true }).click();
  const source = await page.evaluate(() => window.readWorkspacePreview());
  assert.equal(source.kind, "code");
  assert.equal(source.filename, "styles.css");
  assert.match(source.text, /color: red/);

  const read = page.locator('[data-workspace-file-tool="read_file"]');
  await read.locator('[data-slot="tool-fallback-trigger"]').click();
  assert.match(await read.innerText(), /Read app\.ts/);
  await read.getByRole("button", { name: "Open content", exact: true }).click();
  const readPreview = await page.evaluate(() => window.readWorkspacePreview());
  assert.equal(readPreview.kind, "code", "reading HTML or source must open as source, not execute");
  assert.equal(readPreview.filename, "src/app.ts");
  assert.match(readPreview.text, /answer = 42/);

  const list = page.locator('[data-workspace-file-tool="list_directory"]');
  await list.locator('[data-slot="tool-fallback-trigger"]').click();
  assert.match(await list.innerText(), /components/);
  const search = page.locator('[data-workspace-file-tool="search_in_files"]');
  await search.locator('[data-slot="tool-fallback-trigger"]').click();
  assert.match(await search.innerText(), /Search results for "answer"/);
  assert.match(await search.innerText(), /src\/app\.ts:1/);

  const create = page.locator('[data-workspace-file-tool="create_file"]');
  await create.locator('[data-slot="tool-fallback-trigger"]').click();
  assert.match(await create.innerText(), /Empty file/);
  const failed = page.locator('[data-workspace-file-tool="write_file"][data-workspace-file-path="failed.html"]');
  assert.match(await failed.innerText(), /Could not complete failed.html/);
  assert.equal(await failed.getByRole("button", { name: "Preview HTML", exact: true }).count(), 0, "failed writes cannot offer a preview");
  const binaryDiff = page.locator('[data-diff-file="assets/logo.png"]');
  await binaryDiff.getByText(/Added|Añadido/).waitFor();
  await binaryDiff.getByText(/text comparison is unavailable|comparación de texto no está disponible/).waitFor();
  assert.deepEqual(errors, []);
  console.log("Workspace UI: file operations, safe HTML preview, shared source preview, read/list/search cards, failures and binary status passed.");
} finally {
  await browser?.close();
  await server?.close();
}
