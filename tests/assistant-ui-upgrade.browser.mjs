import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import { chromium } from "playwright";
import { frontendDependencyCacheKey } from "../scripts/frontend-dependency-cache.mjs";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const vite = await createServer({
  configFile: false,
  root,
  cacheDir: `${root}node_modules/.vite/spartan-${frontendDependencyCacheKey()}`,
  define: {
    __SPARTA_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version),
  },
  plugins: [react(), {
    name: "assistant-ui-upgrade-fixture",
    configureServer(server) {
      server.middlewares.use("/upgrade-smoke", async (_req, res, next) => {
        try {
          const html = await server.transformIndexHtml("/upgrade-smoke", '<div id="root"></div><script type="module" src="/tests/fixtures/assistant-ui-upgrade.tsx"></script>');
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (error) { next(error); }
      });
    },
  }],
  resolve: { alias: { "@": `${root}src` } },
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/upgrade-smoke`);
  const input = page.getByRole("textbox", { name: "Mensaje" });
  await input.fill("primero");
  await input.press("Enter");
  await page.waitForFunction(() => window.migrationState?.().messages.at(-1)?.status?.type === "complete");
  await page.waitForFunction(() => document.querySelector('[data-testid="assistant"]')?.textContent === "Respuesta: primero");
  assert.equal(await page.getByTestId("assistant").last().textContent(), "Respuesta: primero");
  assert.equal(await page.evaluate(() => window.migrationState().calls), 1, "StrictMode must not duplicate the first send");
  await input.fill("error");
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.waitForFunction(() => window.migrationState().messages.at(-1)?.status?.reason === "error");
  const failed = await page.evaluate(() => window.migrationState().messages.at(-1));
  assert.equal(failed.status.error, "Error de conexión simulado");
  assert.equal(failed.content[0].text, "Respuesta: error");
  await input.fill("cancelar");
  await input.press("Enter");
  await page.waitForFunction(() => window.migrationState().isRunning && window.migrationState().messages.at(-1)?.content[0]?.text === "Respuesta: cancelar");
  await page.evaluate(() => window.migrationCancel());
  await page.waitForFunction(() => !window.migrationState().isRunning);
  assert.equal(await page.evaluate(() => window.migrationState().messages.at(-1).status.reason), "cancelled");
  await input.fill("recuperado");
  await input.press("Enter");
  await page.waitForFunction(() => window.migrationState().messages.at(-1)?.status?.type === "complete");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="assistant"]')].at(-1)?.textContent === "Respuesta: recuperado");
  assert.equal(await page.getByTestId("assistant").last().textContent(), "Respuesta: recuperado");
  assert.equal(await page.evaluate(() => window.migrationState().calls), 4);
  assert.deepEqual(errors, []);
  console.log("assistant-ui upgrade browser OK: first send, StrictMode, streamed text, partial error, cancellation and next send");
} finally {
  await browser?.close();
  await vite.close();
}
