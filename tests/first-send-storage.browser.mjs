import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import { chromium } from "playwright";
import { frontendDependencyCacheKey } from "../scripts/frontend-dependency-cache.mjs";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const server = await createServer({
  configFile: false, root,
  cacheDir: `${root}node_modules/.vite/spartan-${frontendDependencyCacheKey()}`,
  define: { __SPARTA_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version) },
  resolve: { alias: { "@": `${root}src` } },
  plugins: [react(), { name: "first-send-storage-test", configureServer(vite) {
    vite.middlewares.use("/storage-test", async (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(await vite.transformIndexHtml("/storage-test", '<!doctype html><script type="module">import * as storage from "/src/features/chat/utils/chat-history-storage.ts"; window.chatStorage=storage;</script>'));
    });
  } }], server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let ready = false, reads = 0;
  await page.route(url => url.pathname.startsWith("/api/"), route => {
    if (new URL(route.request().url()).pathname === "/api/chat/threads/first-send") {
      reads++;
      return route.fulfill({ status: ready ? 200 : 404, json: ready ? { id: "first-send", title: "New chat", modelType: "base", modelId: "test", createdAt: Date.now() } : {} });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/storage-test`);
  await page.waitForFunction(() => !!window.chatStorage);
  await page.evaluate(() => {
    window.writeGate = new Promise(resolve => { window.finishWrite = resolve; });
    void window.chatStorage.trackStoredChatThreadRecord("first-send", () => window.writeGate);
    window.readFinished = false;
    window.guardedRead = window.chatStorage.getStoredChatThread("first-send", {waitForWrites: true}).then(thread => { window.readFinished = true; return thread; });
  });
  // A browser roundtrip while the gate is held confirms no premature lookup.
  assert.equal(await page.evaluate(() => window.readFinished), false);
  assert.equal(reads, 0, "navigation must wait for creation rather than get a transient 404");
  ready = true;
  await page.evaluate(() => window.finishWrite());
  assert.equal(await page.evaluate(async () => (await window.guardedRead).id), "first-send");
  assert.equal(reads, 1);
  const failedCreation = await page.evaluate(async () => {
    const storage = window.chatStorage;
    await storage.trackStoredChatThreadRecord("failed-send", async () => {throw new Error("offline");}).catch(() => {});
    try { await storage.getStoredChatThread("failed-send", {waitForWrites: true}); return "missing"; }
    catch { return "unconfirmed"; }
  });
  assert.equal(failedCreation, "unconfirmed", "a failed creation is not proof the user deleted the chat");
  // The creator's ordinary read must remain independent of its own pending write.
  await page.evaluate(() => {
    const storage = window.chatStorage;
    return storage.trackStoredChatThreadRecord("first-send", async () => {
      const thread = await storage.getStoredChatThread("first-send");
      if (!thread) throw new Error("creator read failed");
    });
  });
  await page.evaluate(async () => {
    const harness = await import("/tests/fixtures/first-send-runtime.tsx");
    harness.mountRuntimeHarness();
  });
  await page.waitForFunction(() => window.runtimeLifecycle?.mounts === 1);
  const initialLocalId = await page.evaluate(() => {
    window.capturedThread = window.runtimeAui.threadListItem();
    return window.runtimeThreadId;
  });
  for (let tick = 0; tick < 3; tick++) {
    await page.evaluate(() => window.rerenderRuntime());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.runtimeThreadId), initialLocalId, "a parent render must not replace the local thread before its first send");
  }
  const initialized = await page.evaluate(() => window.capturedThread.initialize());
  assert.ok(initialized.remoteId, "the originally captured local thread must still initialize after parent renders");
  await page.evaluate(() => window.adoptRuntimeThread("first-send"));
  // Wait for the real provider's thread switch, not merely the parent setter.
  await page.waitForFunction(async () => {
    const {useChatRuntimeStore} = await import("/src/features/chat/stores/chat-runtime-store.ts");
    return useChatRuntimeStore.getState().activeThreadId === "first-send";
  });
  assert.deepEqual(await page.evaluate(() => window.runtimeLifecycle), { mounts: 1, unmounts: 0 }, "publishing the saved id must not unmount the first-send runtime");
  await page.evaluate(async () => (await import("/tests/fixtures/first-send-runtime.tsx")).mountTitlebarHarness());
  await page.getByRole("button", {name: "Buscar en pruebas"}).click();
  await page.getByRole("button", {name: "Cerrar barra en pruebas"}).click();
  assert.equal(await page.getByTestId("header-clicks").textContent(), "2");
  await page.evaluate(() => window.resizeTitlebarHarness(480));
  await page.waitForFunction(() => parseInt(document.querySelector('[data-slot="electron-window-drag-region"]').style.left) >= 484);
  await page.getByRole("button", {name: "Buscar en pruebas"}).click();
  assert.equal(await page.getByTestId("header-clicks").textContent(), "3");
  assert.deepEqual(errors, []);
  console.log("First-send OK: delayed creation, failed creation preserved, no self-deadlock, real runtime remains mounted when saved id appears");
} finally { await browser?.close(); await server.close(); }
