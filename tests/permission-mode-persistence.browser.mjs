import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import { chromium } from "playwright";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import { frontendDependencyCacheKey } from "../scripts/frontend-dependency-cache.mjs";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const server = await createServer({
  configFile: false, root,
  cacheDir: `${root}node_modules/.vite/spartan-${frontendDependencyCacheKey()}`,
  define: { __SPARTA_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version) },
  resolve: { alias: { "@": `${root}src` } },
  plugins: [react(), { name: "permission-test", configureServer(vite) {
    vite.middlewares.use("/permission-test", async (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(await vite.transformIndexHtml("/permission-test", '<script type="module">import {useChatRuntimeStore} from "/src/features/chat/stores/chat-runtime-store.ts"; window.permissionStore=useChatRuntimeStore;</script>'));
    });
  } }],
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => { errors.push(e.message); console.error(e.message); });
  await page.route(url => url.pathname.startsWith("/api/"), route => route.fulfill({ json: {} }));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/permission-test`;
  const open = async () => { await page.goto(url); await page.waitForFunction(() => !!window.permissionStore); };
  const state = () => page.evaluate(() => {
    const {permissionMode, bypassPermissions, confirmToolCalls} = window.permissionStore.getState();
    return {permissionMode, bypassPermissions, confirmToolCalls};
  });
  await open();
  for (const mode of ["full", "ask", "full", "off", "auto"]) {
    await page.evaluate(mode => window.permissionStore.getState().setPermissionMode(mode), mode);
    await open();
    assert.deepEqual(await state(), {permissionMode: mode, bypassPermissions: mode === "full", confirmToolCalls: mode === "ask" || mode === "auto"});
  }
  await page.evaluate(() => {
    const store = window.permissionStore.getState();
    store.setActiveThreadId("permission-test-thread");
    store.applyThreadScopedSettings("permission-test-thread", {permissionMode: "ask"});
    store.setPermissionMode("full");
  });
  await open();
  await page.evaluate(() => window.permissionStore.getState().applyThreadScopedSettings("permission-test-thread", {permissionMode: "ask"}));
  assert.equal((await state()).permissionMode, "full", "opening a saved thread must preserve the device choice");
  await page.evaluate(() => window.permissionStore.getState().setPermissionMode("auto"));
  await open();
  await page.evaluate(() => window.permissionStore.getState().setBypassPermissions(true));
  await open();
  assert.equal((await state()).permissionMode, "full");
  await page.evaluate(() => window.permissionStore.getState().setBypassPermissions(false));
  await open();
  assert.equal((await state()).permissionMode, "auto");
  await page.evaluate(() => {
    window.permissionStore.getState().setPermissionMode("full");
    window.permissionStore.getState().setDeepResearchEnabled(true);
  });
  await open();
  assert.equal((await state()).bypassPermissions, false);
  assert.deepEqual(errors, []);
  console.log("Permission persistence OK: reload, full access, all modes, legacy toggle, research transition");
} finally { await browser?.close(); await server.close(); }
