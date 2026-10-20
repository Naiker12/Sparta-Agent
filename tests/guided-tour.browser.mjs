import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwind from "../desktop/frontend-spartan/node_modules/@tailwindcss/vite/dist/index.mjs";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const vite = await createServer({configFile: false, root, cacheDir: `${root}node_modules/.vite/tour-tests`, resolve: {alias: {"@": `${root}src`}}, css: {postcss: {plugins: []}}, plugins: [react(), tailwind(), {name: "tour-test", configureServer(server) {server.middlewares.use("/tour-test", async (_req, res) => {res.setHeader("Content-Type", "text/html");res.end(await server.transformIndexHtml("/tour-test", '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/tests/fixtures/guided-tour.tsx"></script>'));});}}], server: {host: "127.0.0.1", port: 0, hmr: false, watch: null}});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({channel: "msedge", headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/tour-test`, {timeout: 120000});
  await page.getByRole("dialog", {name: "Bienvenido a Spartan"}).waitFor();
  const key = "spartan:guided-tour:chat:first-visit";
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), "shown");
  // A reload during the tour must not start it again.
  await page.reload();
  await page.locator('[data-testid="tour-ready"][data-open="false"]').waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", {name: "Recorrido guiado", exact: true}).click();
  await page.getByRole("dialog", {name: "Bienvenido a Spartan"}).waitFor();
  await page.getByRole("button", {name: "Omitir", exact: true}).click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), "skipped");
  await page.reload();
  await page.locator('[data-testid="tour-ready"][data-open="false"]').waitFor();
  await page.getByRole("button", {name: "Recorrido guiado", exact: true}).click();
  for (let step = 1; step < 12; step++) {
    await page.getByRole("dialog").getByText(`${step}/12`, {exact: false}).waitFor();
    await page.getByRole("button", {name: "Siguiente", exact: true}).click();
  }
  await page.getByRole("dialog", {name: "Todo listo para empezar"}).waitFor();
  await page.getByRole("button", {name: "Listo", exact: true}).click({trial: true});
  const geometry = await page.getByRole("dialog").evaluate(el => ({dialog: el.getBoundingClientRect().toJSON(), title: el.querySelector('h2').getBoundingClientRect().toJSON()}));
  assert.ok(geometry.title.top >= geometry.dialog.top && geometry.title.left >= geometry.dialog.left, "tour title must remain inside the visible card after all steps");
  await page.screenshot({path: `${process.env.TEMP}/spartan-guided-tour.png`, animations: "disabled"});
  await page.getByRole("button", {name: "Listo", exact: true}).click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), "done");
  await page.reload();
  await page.locator('[data-testid="tour-ready"][data-open="false"]').waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.setViewportSize({width: 390, height: 700});
  await page.locator('[data-tour="navbar"]').evaluate(el => el.remove());
  await page.getByRole("button", {name: "Recorrido guiado", exact: true}).click();
  await page.getByRole("button", {name: "Siguiente", exact: true}).click();
  await page.getByRole("dialog", {name: "Tus conversaciones, siempre a mano"}).waitFor();
  await page.getByRole("button", {name: "Siguiente", exact: true}).click({trial: true});
  const mobile = await page.getByRole("dialog").boundingBox();
  assert.ok(mobile.x >= 0 && mobile.x + mobile.width <= 390 && mobile.y >= 0 && mobile.y + mobile.height <= 700, "missing targets on mobile must use a visible fallback card");
  await page.keyboard.press("Escape");
  await page.locator('[data-testid="tour-ready"][data-open="false"]').waitFor();
  assert.deepEqual(errors, []);
  console.log("Guided tour OK: first visit only, reload mid-tour, manual reopen, skip, 12 steps and completion");
} finally { await browser?.close(); await vite.close(); }
