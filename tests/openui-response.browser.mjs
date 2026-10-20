import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwind from "../desktop/frontend-spartan/node_modules/@tailwindcss/vite/dist/index.mjs";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const vite = await createServer({
  configFile: false, root,
  define: { __SPARTA_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version) },
  css: { postcss: { plugins: [] } },
  plugins: [react(), tailwind(), { name: "openui-fixture", configureServer(server) {
    server.middlewares.use("/navigator-smoke", async (_req, res, next) => {
      try { res.setHeader("Content-Type", "text/html"); res.end(await server.transformIndexHtml("/navigator-smoke", '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/tests/fixtures/conversation-navigator.tsx"></script>')); }
      catch (error) { next(error); }
    });
    server.middlewares.use("/openui-smoke", async (_req, res, next) => {
      try { res.setHeader("Content-Type", "text/html"); res.end(await server.transformIndexHtml("/openui-smoke", '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/tests/fixtures/openui-response.tsx"></script>')); }
      catch (error) { next(error); }
    });
  } }],
  resolve: { alias: { "@": `${root}src` } }, server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1050, height: 850 } });
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(60_000);
  const errors = [], external = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/openui-smoke`, { waitUntil: "domcontentloaded" });
  const input = page.getByRole("textbox", { name: "Mensaje" });
  await input.fill("comparar"); await input.press("Enter");
  await page.waitForFunction(() => window.openuiState?.().messages.at(-1)?.status?.type === "complete");
  assert.equal(await page.locator('[data-response-ui="comparison"]').count(), 0);
  const exported = await page.evaluate(() => window.openuiExport());
  const canonical = JSON.stringify(exported);
  await page.evaluate(() => window.openuiEnable(true));
  await page.locator('[data-response-ui="comparison"]').waitFor();
  await page.getByRole("button", { name: "Ver gráfico" }).click();
  await page.getByRole("figure", { name: "Nombre — Cantidad (unidades)" }).waitFor();
  await page.getByRole("button", { name: "Ver tabla" }).click();
  await page.getByRole("button", { name: "Nombre", exact: true }).click();
  await page.getByRole("button", { name: "Ver como texto" }).click();
  assert.equal(await page.locator('[data-response-ui="comparison"]').count(), 0);
  await page.getByRole("button", { name: "Ver presentación" }).click();
  await page.locator('[data-response-ui="comparison"]').waitFor();
  assert.equal(JSON.stringify(await page.evaluate(() => window.openuiExport())), canonical);
  await page.evaluate((value) => window.openuiRestore(value), JSON.parse(canonical));
  await page.locator('[data-response-ui="comparison"]').waitFor();
  await input.fill("imagen"); await input.press("Enter");
  await page.locator('[data-response-ui="gallery"]').waitFor();
  assert.deepEqual(external, [], "rendering must not contact external services or image sites");
  await page.screenshot({ path: path.join(tmpdir(), "spartan-openui-light.png"), animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('table')).color === getComputedStyle(document.body).color);
  await page.screenshot({ path: path.join(tmpdir(), "spartan-openui-dark.png"), animations: "disabled" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("button", { name: "Cargar imágenes" }).click();
  await page.locator('[data-response-ui="gallery"]').scrollIntoViewIfNeeded();
  await page.getByText("No se pudo cargar la imagen. Puedes consultar el origen.").waitFor();
  assert.deepEqual(external, ["https://images.example.org/photo.png"]);
  await input.fill("panel"); await input.press("Enter");
  await page.locator('[data-response-ui="panel"]').waitFor();
  await page.waitForFunction(() => !window.openuiState().isRunning);
  const form = page.locator('[data-response-ui="panel"] form');
  await form.getByRole("button", { name: "Enviar al chat" }).click();
  await form.getByText("Revisa el valor de este campo.").first().waitFor();
  await form.getByLabel("Nombre", { exact: false }).fill("Ana");
  await form.getByLabel("Cantidad", { exact: false }).fill("0");
  const draftHistory = await page.evaluate(() => window.openuiExport());
  await page.reload();
  await page.getByRole("button", {name: "Presentación activa"}).waitFor();
  await page.evaluate(value => window.openuiRestore(value), JSON.parse(JSON.stringify(draftHistory)));
  await form.getByLabel("Nombre", {exact: false}).waitFor();
  assert.equal(await form.getByLabel("Nombre", {exact: false}).inputValue(), "Ana", "reload must restore unsent drafts");
  assert.equal(await form.getByLabel("Cantidad", {exact: false}).inputValue(), "0");
  await page.getByRole("button", { name: "Ver como texto", exact: true }).last().click();
  await form.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Ver presentación", exact: true }).last().click();
  assert.equal(await form.getByLabel("Nombre", { exact: false }).inputValue(), "Ana", "switching views must preserve the draft");
  await form.getByRole("button", { name: "Enviar al chat" }).click();
  await form.getByRole("button", { name: "Enviado al chat" }).waitFor();
  await page.waitForFunction(() => !window.openuiState().isRunning);
  const formMessages = await page.evaluate(() => window.openuiState().messages.filter((message) => message.metadata.custom?.responseUiSubmission));
  assert.equal(formMessages.length, 1);
  assert.match(formMessages[0].content[0].text, /Cantidad: 0/);
  assert.match(formMessages[0].content[0].text, /Activo: No/);
  const receipt = page.getByTestId("user-submission").last();
  await receipt.locator('[data-response-ui="panel"]').waitFor();
  assert.match(await receipt.textContent(), /Ana/);
  assert.match(await receipt.textContent(), /No/);
  assert.ok(!(await receipt.textContent()).includes('"field"'));
  const withForm = await page.evaluate(() => window.openuiExport());
  await page.evaluate(() => window.openuiRestore({ messages: [], headId: null }));
  await page.locator('[data-response-ui="panel"]').waitFor({ state: "detached" });
  await page.evaluate((value) => window.openuiRestore(value), JSON.parse(JSON.stringify(withForm)));
  await page.locator('[data-response-ui="panel"] form').getByRole("button", { name: "Enviado al chat" }).waitFor();
  assert.equal(await form.getByLabel("Nombre", { exact: false }).inputValue(), "Ana");
  assert.equal(await form.getByLabel("Cantidad", { exact: false }).inputValue(), "0");
  await page.screenshot({ path: path.join(tmpdir(), "spartan-openui-panel.png"), animations: "disabled" });
  await input.fill("autochart"); await input.press("Enter");
  await page.getByRole("figure", {name: "Equipo — Ventas (unidades)"}).waitFor();
  await page.getByRole("button", {name: "Ver tabla", exact: true}).click();
  await page.getByRole("columnheader", {name: "Ventas (unidades)"}).waitFor();
  await input.fill("fuentes"); await input.press("Enter");
  await page.waitForFunction(() => !window.openuiState().isRunning);
  await page.locator('[data-slot="tool-group-trigger"]').last().click();
  await page.getByText('Buscó "fuentes"', {exact: true}).click();
  await page.getByText("Datos publicados en el informe original.", {exact: true}).waitFor();
  assert.equal(await page.getByText("Duplicada", {exact: true}).count(), 0);
  assert.deepEqual(external, ["https://images.example.org/photo.png"], "panels and forms must not make external requests");
  await page.evaluate(() => window.openuiEnable(false));
  await page.waitForFunction(() => !document.querySelector("[data-response-ui]"));
  assert.deepEqual(errors, []);
  const navPage = await browser.newPage({viewport: {width: 1000, height: 700}});
  const navErrors = [];
  navPage.on("pageerror", error => navErrors.push(error.message));
  await navPage.goto(`http://127.0.0.1:${vite.httpServer.address().port}/navigator-smoke`);
  const navigator = navPage.getByRole("navigation", {name: "Navegar por la conversación"});
  await navigator.waitFor();
  assert.equal(await navigator.getByRole("button").count(), 12);
  await navigator.getByRole("button").last().hover();
  await navPage.getByText("Contenido de prueba 12. Vista previa del mensaje.", {exact: true}).last().waitFor();
  await navigator.getByRole("button").last().click();
  await navPage.waitForFunction(() => document.querySelector('[data-testid="nav-viewport"]').scrollTop > 1000);
  await navigator.getByRole("button").last().focus();
  await navPage.keyboard.press("Home");
  await navPage.keyboard.press("Enter");
  await navPage.waitForFunction(() => document.querySelector('[data-testid="nav-viewport"]').scrollTop < 20);
  await navPage.screenshot({path: path.join(tmpdir(), "spartan-conversation-navigator.png"), animations: "disabled"});
  assert.deepEqual(navErrors, []);
  await navPage.close();
  // A missing lazy chunk must degrade to canonical text, not fail the run.
  const fallbackPage = await browser.newPage();
  fallbackPage.setDefaultTimeout(25_000);
  let blockedRenderer = 0;
  await fallbackPage.route(/\/response-ui\/rich-renderer\.tsx/, (route) => {
    blockedRenderer++;
    return route.abort();
  });
  await fallbackPage.goto(`http://127.0.0.1:${vite.httpServer.address().port}/openui-smoke`, { waitUntil: "domcontentloaded" });
  await fallbackPage.waitForFunction(() => typeof window.openuiEnable === "function");
  await fallbackPage.evaluate(() => window.openuiEnable(true));
  await fallbackPage.getByRole("textbox", { name: "Mensaje" }).fill("comparar");
  await fallbackPage.getByRole("textbox", { name: "Mensaje" }).press("Enter");
  await fallbackPage.waitForFunction(() => window.openuiState?.().messages.at(-1)?.status?.type === "complete");
  await fallbackPage.getByRole("table").waitFor();
  await fallbackPage.waitForFunction(() => document.querySelector('table')?.textContent?.includes('Gamma'));
  assert.ok(blockedRenderer > 0, "the unavailable renderer path was exercised");
  assert.equal(await fallbackPage.locator("[data-response-ui]").count(), 0);
  await fallbackPage.close();
  console.log("OpenUI browser OK: opt-in, table/chart/text, canonical export/restore, gallery privacy/error fallback, narrow dark layout, no page errors");
} finally { await browser?.close(); await vite.close(); }
