import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwind from "../desktop/frontend-spartan/node_modules/@tailwindcss/vite/dist/index.mjs";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const vite = await createServer({configFile: false, root, cacheDir: `${root}node_modules/.vite/channel-files-tests`, resolve: {alias: {"@": `${root}src`}}, css: {postcss: {plugins: []}}, plugins: [react(), tailwind(), {name: "tour-test", configureServer(server) {server.middlewares.use("/channel-files-test", async (_req, res) => {res.setHeader("Content-Type", "text/html");res.end(await server.transformIndexHtml("/channel-files-test", '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/tests/fixtures/channel-files.tsx"></script>'));});}}], server: {host: "127.0.0.1", port: 0, hmr: false, watch: null}});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({channel: "msedge", headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let mode = "missing-route";
  let gets = 0, puts = 0;
  await page.route("**/api/channels/test-account/files", route => {
    if (route.request().method() === "PUT") {puts++; return route.fulfill({json: {ok: true}});}
    gets++;
    if (mode === "missing-route") return route.fulfill({status: 404, json: {detail: "Not Found"}});
    if (mode === "missing-account") return route.fulfill({status: 404, json: {detail: "account_not_found"}});
    return route.fulfill({json: {permissions: {"123": {web_download: true, file_create: true, file_send: false}}}});
  });
  const url = `http://127.0.0.1:${vite.httpServer.address().port}/channel-files-test`;
  await page.goto(url, {timeout: 120000});
  const manage = page.getByRole("button", {name: "Gestionar permisos de archivos", exact: true});
  await manage.click();
  await page.getByRole("alert").filter({hasText: "Cierra y vuelve a abrir Spartan"}).waitFor();
  assert.equal(await manage.isDisabled(), true);
  assert.equal(gets, 1);
  assert.equal(puts, 0);
  mode = "missing-account";
  await page.reload();
  await manage.click();
  await page.getByRole("alert").filter({hasText: "Esta conexión ya no está disponible"}).waitFor();
  assert.equal(await manage.isDisabled(), true);
  mode = "ready";
  await page.reload();
  await manage.click();
  await page.getByRole("checkbox").nth(2).waitFor();
  assert.equal(await page.getByRole("checkbox").nth(2).isChecked(), false);
  await page.getByRole("checkbox").nth(2).click();
  await page.waitForFunction(() => document.querySelectorAll('[role="checkbox"][data-state="checked"]').length === 3);
  assert.equal(puts, 1);
  assert.deepEqual(errors, []);
  console.log("Channel file permissions OK: old backend 404, missing account 404, no repeat or fallback grant, normal read/write");
} finally { await browser?.close(); await vite.close(); }
