import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = root + "desktop/frontend-spartan/";
const backend = root + "desktop/backend-spartan/";
const python = process.env.SPARTA_TEST_PYTHON || backend + (process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const child = spawn(python, ["-u", "-m", "tests.turn_changes_fixture_server"], { cwd: backend, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
const requireFrontend = createRequire(frontend + "package.json");
const { createServer } = await import(pathToFileURL(requireFrontend.resolve("vite")).href);
let browser, server;
try {
  const info = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Backend fixture did not start")), 60_000);
    let output = "";
    child.stdout.on("data", data => {
      output += data.toString();
      const line = output.split(/\r?\n/).find(value => value.startsWith("TURN_CHANGES_FIXTURE:"));
      if (line) { clearTimeout(timer); resolve(JSON.parse(line.slice("TURN_CHANGES_FIXTURE:".length))); }
    });
    child.stderr.on("data", data => process.stderr.write(data));
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", code => { clearTimeout(timer); reject(new Error(`Backend fixture exited: ${code}`)); });
  });
  const request = async (path, method = "GET") => {
    const response = await fetch(info.url + path, { method });
    assert.equal(response.status, 200);
    return response.json();
  };
  // The socket is reserved before Uvicorn starts accepting connections.
  for (let attempt = 0; ; attempt++) {
    try { await request("/fixture/state"); break; }
    catch (error) { if (attempt > 30) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  server = await createServer({ root: frontend, configFile: frontend + "vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname.startsWith("/api/chat/threads/fixture/changes")) {
      const response = await route.fetch({ url: info.url + url.pathname + url.search });
      return route.fulfill({ response });
    }
    return route.fulfill({ json: {} });
  });
  const open = id => page.goto(server.resolvedUrls.local[0] + `tests/fixtures/turn-changes-harness.html?id=${id}`, { timeout: 120_000 });
  await open(info.id);
  await page.getByRole("button", { name: /^(View changes|Ver cambios)$/, exact: true }).waitFor();
  await page.getByText(/3 files changed|Se han modificado 3 archivos/, { exact: true }).waitFor();
  for (const path of ["app.js", "index.html", "notes.txt"]) assert.equal(await page.getByRole("button", { name: new RegExp(path.replace(".", "\\.")) }).count(), 1);
  await page.screenshot({ path: root + "docs/audits/turn-changes-summary.png" });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.getByRole("button", { name: /^(View changes|Ver cambios)$/, exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("dialog").getByText(/export const value = 2/, { exact: false }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "index.html", exact: true }).click();
  await page.getByRole("dialog").getByText(/Project/, { exact: false }).first().waitFor();
  assert.equal(await page.locator('[data-slot="sheet-content"]').count(), 1, "diff uses the shared Sheet");
  assert.equal(await page.locator('[data-slot="dialog-content"]').count(), 0, "no separate diff modal");
  await page.screenshot({ path: root + "docs/audits/turn-changes-sheet.png" });
  await page.getByRole("button", { name: "Open other file", exact: true }).click();
  await page.getByRole("dialog").getByText("Other file preview", { exact: true }).waitFor();
  assert.equal(await page.getByRole("tab").count(), 2);
  await page.getByRole("tab", { name: /^(View changes|Ver cambios)$/, exact: true }).click();
  await page.getByRole("dialog").getByText(/Project/, { exact: false }).first().waitFor();
  await page.getByRole("button", { name: /^(View changes|Ver cambios)$/, exact: true }).click();
  assert.equal(await page.getByRole("tab").count(), 2, "reopening the same response reuses its tab");
  await page.setViewportSize({ width: 390, height: 850 });
  await page.getByRole("dialog").getByText(/export const value = 2/, { exact: false }).waitFor();
  const sheet = page.locator('[data-slot="sheet-content"]');
  assert.ok(await sheet.evaluate(node => node.getBoundingClientRect().width <= innerWidth));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.getByRole("button", { name: /^(Undo|Deshacer)$/ }).click();
  await page.getByText(/Changes undone|Cambios deshechos/, { exact: true }).waitFor();
  const restored = await request("/fixture/state");
  assert.equal(restored["app.js"], "export const value = 1;\n");
  assert.equal(restored["notes.txt"], "original note\n");
  assert.equal(restored["index.html"], undefined);
  await page.reload();
  await page.getByText(/Changes undone|Cambios deshechos/, { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^(Undo|Deshacer)$/ }).count(), 0);
  const unverified = await request("/fixture/unverified-capture", "POST");
  const unverifiedSummary = await request(`/api/chat/threads/fixture/changes/${unverified.id}`);
  assert.equal(unverifiedSummary.complete, true, "the workspace snapshot completed");
  assert.equal(unverifiedSummary.canUndo, false, "unattributed writes cannot be undone");
  assert.equal(unverifiedSummary.undoReason, "unverified_changes");
  await open(unverified.id);
  await page.getByRole("button", { name: /^(View changes|Ver cambios)$/, exact: true }).waitFor();
  await page.getByText(/cannot be safely attributed|no se pueden atribuir de forma segura/i).waitFor();
  assert.equal(await page.getByRole("button", { name: /^(Undo|Deshacer)$/ }).count(), 0);
  const next = await request("/fixture/capture", "POST");
  await open(next.id);
  await page.getByRole("button", { name: /^(Undo|Deshacer)$/ }).waitFor();
  await request("/fixture/later-edit", "POST");
  const beforeConflict = await request("/fixture/state");
  await page.getByRole("button", { name: /^(Undo|Deshacer)$/ }).click();
  await page.getByRole("alert").filter({ hasText: /later edits|cambios posteriores/ }).waitFor();
  assert.deepEqual(await request("/fixture/state"), beforeConflict);
  // Keyboard and narrow layout keep actions reachable and paths contained.
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.locator("[data-slot=card]").evaluate(node => node.scrollWidth <= node.clientWidth));
  assert.deepEqual(errors, []);
  console.log("Turn changes: real API snapshots, message metadata, counts, file diff, undo, reload, conflict protection and narrow layout passed.");
} finally {
  await browser?.close();
  await server?.close();
  child.kill();
}
