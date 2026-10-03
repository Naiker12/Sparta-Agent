// Run with `node tests/startup-flow.browser.mjs` while `npm run dev` is running.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, channel: "msedge" });
const url = "http://127.0.0.1:5173/startup-smoke";
const html = `<div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script>
<script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {StartupGate} from '/desktop/frontend-spartan/src/features/setup/startup-gate.tsx';
ReactDOM.createRoot(document.getElementById('root')).render(
 React.createElement(StartupGate,null,React.createElement('div',{'data-testid':'ready'},'Ready'))
);
</script>`;

try {
  for (const scenario of ["starting", "ready", "auth_failed", "missing"]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => console.error(error.message));
    await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: html }));
    await page.addInitScript((scenario) => {
      window.electronAPI = {
        getBackendStatus: async () => scenario === "missing"
          ? { error: "El entorno del backend de Sparta aún no está preparado." }
          : scenario === "starting" ? {} : { port: 12345 },
        authenticateBackend: async () => {
          if (scenario === "auth_failed") throw new Error("Desktop authentication failed (401)");
          return { access_token: "test-access", refresh_token: "test-refresh" };
        },
        onBackendReady: (listener) => { window.readyListener = listener; return () => {}; },
      };
    }, scenario);
    await page.goto(url);
    if (scenario === "ready") {
      await page.getByTestId("ready").waitFor();
    } else {
      await page.getByRole("button", { name: "Entrar a Sparta" }).click();
      if (scenario === "starting") {
        if (await page.getByRole("button", { name: /Instalar/ }).count()) {
          throw new Error("Installation offered while the existing runtime is starting");
        }
        await page.evaluate(() => window.readyListener(12345));
        await page.getByTestId("ready").waitFor();
      } else if (scenario === "auth_failed") {
        await page.getByRole("button", { name: "Reintentar conexión" }).waitFor();
        if (await page.getByRole("button", { name: /Instalar/ }).count()) {
          throw new Error("Installation offered for an authentication failure");
        }
      } else {
        await page.getByRole("button", { name: "Instalar o reparar backend" }).waitFor();
      }
    }
    console.log("Startup UI OK:", scenario);
    await page.close();
  }
} finally {
  await browser.close();
}
