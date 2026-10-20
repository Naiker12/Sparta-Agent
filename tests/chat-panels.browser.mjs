import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "../desktop/frontend-spartan/node_modules/vite/dist/node/index.js";
import react from "../desktop/frontend-spartan/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwind from "../desktop/frontend-spartan/node_modules/@tailwindcss/vite/dist/index.mjs";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const vite = await createServer({configFile: false, root, cacheDir: `${root}node_modules/.vite/chat-panels-tests`, define: {__SPARTA_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version)}, resolve: {alias: {"@": `${root}src`}}, css: {postcss: {plugins: []}}, plugins: [react(), tailwind(), {name: "panels-fixture", configureServer(server) {server.middlewares.use("/panels-test", async (_req, res) => {res.setHeader("Content-Type", "text/html");res.end(await server.transformIndexHtml("/panels-test", '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/tests/fixtures/chat-panels.tsx"></script>'));});}}],server: {host: "127.0.0.1", port: 0, hmr: false, watch: null}});
let browser, debugPage;
const threads = new Map(["primary", "alpha", "beta"].map((id, index) => [id, {id, title: id, modelType: "base", modelId: `external::test-provider::${index === 2 ? "model-b" : "model-a"}`, archived: false, createdAt: Date.now()}]));
const messages = new Map([["primary", [{id: "p-user",threadId: "primary",role: "user", content: [{type: "text", text: "Objetivo: preparar Spartan. Pendiente: revisar las pruebas."}],createdAt: 1}]], ["alpha", []], ["beta", []]]);
messages.get("primary")[0].attachments = [{id: "plan-attachment", type: "file", name: "plan.pdf", contentType: "application/pdf", status: {type: "complete"}, content: [{type: "text", text: "Presupuesto registrado: 250"}]}];
messages.get("primary").push({id: "p-result", threadId: "primary", parentId: "p-user", role: "assistant", createdAt: 2, content: [
  {type: "text", text: "Decisión: conservar el contexto de la tarea.\n<tool_call>\n</tool_call> <tool_call>\n</tool_call>\n"},
  {type: "tool-call", toolCallId: "prior-search", toolName: "web_search", args: {query: "DO_NOT_COPY_ARGS"}, argsText: "{}", result: "Title: Referencia\nURL: https://example.org/research\nSnippet: Información verificada para la tarea."},
  {type: "tool-call", toolCallId: "prior-test", toolName: "terminal", args: {}, argsText: "{}", result: {stdout: "2 pruebas superadas", sessionId: "DO_NOT_COPY_SESSION"}},
  {type: "tool-call", toolCallId: "prior-failure", toolName: "rename_path", args: {}, argsText: "{}", result: "Error: destination already exists"},
]});
const requests = [], releases = [];
const workspaceWrites = [];
const draftBindings = new Map();
let notifyRequest = () => {};
let offline = false;
try {
  await vite.listen(); browser = await chromium.launch({channel: "msedge", headless: true});
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}}); page.setDefaultTimeout(60000);
  debugPage = page;
  const errors = []; page.on("pageerror", error => {errors.push(error.message); console.error(error.message);});
  await page.addInitScript(() => localStorage.setItem("sparta.pending-workspace", JSON.stringify({folder: "D:/AUTEM", access: "write_no_delete"})));
  page.on("console", message => { if (message.type() === "error") console.error(message.text().slice(0, 1200)); });
  await page.route(url => url.pathname.startsWith("/api/") || url.pathname === "/v1/chat/completions", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const body = method === "GET" ? undefined : req.postDataJSON();
    if (path === "/api/chat/threads/offline-panel" && offline) return route.fulfill({status: 503, json: {detail: "Temporarily offline"}});
    if (path === "/api/chat/settings") return route.fulfill({json: {settings: {}}});
    if (path === "/v1/chat/completions") {
      requests.push(body); notifyRequest(); await new Promise(resolve => releases.push(resolve));
      return route.fulfill({contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"PANEL_OK"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'}).catch(() => {});
    }
    if (path === "/api/chat/threads" && method === "POST") {threads.set(body.id, body);messages.set(body.id, []);return route.fulfill({json: body});}
    if (path === "/api/chat/threads" && method === "GET") return route.fulfill({json: {threads: [...threads.values()]}});
    if (path === "/api/chat/messages:batch") return route.fulfill({json: {messagesByThreadId: Object.fromEntries(body.threadIds.map(id => [id, messages.get(id) ?? []]))}});
    const match = path.match(/^\/api\/chat\/threads\/([^/]+)(?:\/messages(?:\/([^/]+))?)?$/);
    if (match) {
      const [,id,messageId] = match;
      if (path.includes("/messages")) {
        const rows = messages.get(id) ?? [];
        if (method === "PUT" && messageId) { const filtered = rows.filter(row => row.id !== messageId); filtered.push(body); messages.set(id, filtered); return route.fulfill({json: body}); }
        if (method === "PUT") { messages.set(id, body.messages);return route.fulfill({json: {messages: body.messages}}); }
        return route.fulfill({json: messageId ? rows.find(row => row.id === messageId) ?? null : {messages: rows}});
      }
      if (method === "PATCH") {threads.set(id, {...threads.get(id), ...body});return route.fulfill({json: threads.get(id)});}
      return route.fulfill({status: threads.has(id) ? 200 : 404, json: threads.get(id) ?? {}});
    }
    if (path.endsWith("/workspace")) {
      const id = path.split("/").at(-2);
      if (method !== "GET") workspaceWrites.push({id, method, body});
      if (method === "PUT") {
        const binding = {threadId: id, bindingId: `binding-${id}`, canonicalPath: body.folderPath, access: body.access};
        draftBindings.set(id, binding);
        return route.fulfill({json: binding});
      }
      if (draftBindings.has(id)) return route.fulfill({json: draftBindings.get(id)});
      if (["primary", "alpha", "beta"].includes(id)) return route.fulfill({json: {id: `workspace-${id}`, threadId: id, bindingId: `binding-${id}`, canonicalPath: `D:/${id === "primary" ? "pdf" : id}`, access: "write_no_delete", displayName: id}});
      return route.fulfill({status: 404,json: {}});
    }
    return route.fulfill({json: {}});
  });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/panels-test`, {waitUntil: "domcontentloaded", timeout: 120000});
  console.log("Panels fixture loaded");
  await page.waitForFunction(() => document.querySelector('[data-testid="primary-message"]')?.textContent.includes("Objetivo:"), null, {timeout: 90000});
  console.log("Main history loaded");
  await page.locator('[data-testid="primary-message"] .composer-pill-workspace').filter({hasText: "pdf"}).waitFor();
  assert.equal(workspaceWrites.length, 0, "opening a saved chat must never bind the pending draft folder");
  assert.doesNotMatch(await page.locator('[data-testid="primary-message"] .composer-workspace-bar').innerText(), /AUTEM/);
  await page.evaluate(async () => {
    const workspace = await import("/src/features/chat/utils/pending-workspace.ts");
    if (await workspace.ensureThreadWorkspace("unrelated-empty")) throw new Error("Unclaimed chat inherited a draft folder");
    workspace.claimPendingWorkspace("claimed-draft");
    workspace.setPendingWorkspace({folder: "D:/next-draft", access: "read"});
    const binding = await workspace.ensureThreadWorkspace("claimed-draft");
    if (binding?.canonicalPath !== "D:/AUTEM") throw new Error("The new chat lost its captured draft folder");
    if (workspace.getPendingWorkspace()?.folder !== "D:/next-draft") throw new Error("Binding an old draft cleared the new draft's folder");
    workspace.setPendingWorkspace({folder: "D:/AUTEM", access: "write_no_delete"});
  });
  assert.deepEqual(workspaceWrites.map(({id}) => id), ["claimed-draft"]);
  workspaceWrites.length = 0;
  const activity = page.locator(".aui-tool-group-root").first();
  await activity.locator('[data-slot="tool-group-trigger"]').waitFor();
  assert.equal(await activity.getAttribute("data-state"), "closed");
  assert.doesNotMatch(await page.locator(".aui-thread-root").first().innerText(), /<\/?tool_call>/);
  await activity.locator('[data-slot="tool-group-trigger"]').click();
  await page.waitForFunction(() => document.querySelector(".aui-tool-group-root")?.getAttribute("data-state") === "open");
  await activity.locator('[data-slot="tool-group-trigger"]').click();
  await page.waitForFunction(() => document.querySelector(".aui-tool-group-root")?.getAttribute("data-state") === "closed");
  console.log("Tool protocol cleanup and activity expand/collapse verified");
  await page.getByRole("button", {name: "Nuevo chat en panel", exact: true}).first().click();
  await page.waitForFunction(() => window.panelHarness.store.getState().panes.length === 1);
  const emptyId = await page.evaluate(() => window.panelHarness.store.getState().panes[0].thread.id);
  const emptyPane = page.locator("[data-chat-pane-id]").first();
  await emptyPane.locator(".aui-thread-welcome-message-inner").first().waitFor();
  await emptyPane.locator(".spartan-composer-surface").waitFor();
  assert.equal((messages.get(emptyId) ?? []).length, 0, "new chat must start empty rather than reuse the visible conversation");
  assert.equal(requests.length, 0);
  assert.ok((await emptyPane.locator("[data-chat-pane-header]").boundingBox()).y < 2, "pane titles must share the existing toolbar row without an empty row above");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({path: `${process.env.TEMP}/spartan-empty-panel-corrected.png`, animations: "disabled"});
  await emptyPane.getByRole("button", {name: "Cerrar panel",exact: true}).click();
  // Dedicated MIME drop, followed by menu-equivalent opening; neither replaces the main runtime.
  await page.evaluate(() => { const transfer = new DataTransfer();transfer.setData("application/x-spartan-chat-thread", "alpha");document.querySelector('[data-slot="resizable-panel-group"]').parentElement.dispatchEvent(new DragEvent("drop", {dataTransfer: transfer, bubbles: true})); });
  await page.getByRole("textbox", {name: "Escribe a este chat…"}).waitFor();
  console.log("First panel loaded");
  await page.evaluate(() => window.panelHarness.open("beta"));
  await page.getByRole("textbox", {name: "Escribe a este chat…"}).nth(1).waitFor();
  await page.evaluate(() => window.panelHarness.open("alpha"));
  assert.equal(await page.evaluate(() => window.panelHarness.store.getState().panes.length), 2);
  assert.deepEqual(await page.evaluate(() => window.panelHarness.lifecycle), {mounts: 1, unmounts: 0});
  assert.equal(await page.evaluate(() => window.panelHarness.runtime.getState().activeThreadId), "primary");
  const rail = page.locator("[data-workspace-panel-container]");
  assert.equal(await rail.count(), 1);
  const railBox = await rail.boundingBox();
  assert.ok(Math.abs(railBox.x + railBox.width - 1600) < 2, "the file rail must remain at the far right of the entire workspace");
  const separator = page.getByRole("separator", {name: "Ajustar ancho de los chats"}).first();
  const beforeResize = await page.locator("#primary-chat").boundingBox();
  const handle = await separator.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down(); await page.mouse.move(handle.x + 80, handle.y + handle.height / 2, {steps: 10}); await page.mouse.up();
  assert.ok(Math.abs((await page.locator("#primary-chat").boundingBox()).width - beforeResize.width) > 30, "mouse resizing must change pane width");
  const movers = page.getByRole("button", {name: "Mover panel",exact: true});
  await movers.nth(1).dragTo(movers.nth(0));
  await page.waitForFunction(() => window.panelHarness.store.getState().panes[0].thread.id === "beta");
  await movers.nth(1).dragTo(movers.nth(0));
  await page.waitForFunction(() => window.panelHarness.store.getState().panes[0].thread.id === "alpha");
  assert.equal(requests.length, 0, "moving panels must not create or send messages");
  const alphaPane = page.locator("[data-chat-pane-id]").first();
  await alphaPane.locator(".composer-pill-workspace").filter({hasText: "alpha"}).waitFor();
  await page.locator('[data-chat-pane-id]').nth(1).locator(".composer-pill-workspace").filter({hasText: "beta"}).waitFor();
  await alphaPane.getByRole("button", {name: "Herramientas y adjuntos",exact: true}).click();
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", {name: "Adjuntar archivo",exact: true}).click();
  await (await choosing).setFiles({name: "pane-note.txt", mimeType: "text/plain", buffer: Buffer.from("Archivo exclusivo del panel alpha")});
  await alphaPane.getByRole("button", {name: /attachment: pane-note\.txt/}).waitFor();
  const inputs = page.getByRole("textbox", {name: "Escribe a este chat…"});
  await inputs.nth(0).fill("Mensaje independiente A"); await inputs.nth(1).fill("Borrador independiente B");
  await alphaPane.getByRole("button", {name: "Enviar",exact: true}).waitFor();
  assert.equal(await inputs.nth(0).inputValue(), "Mensaje independiente A");
  await inputs.nth(0).press("Enter");
  await page.waitForFunction(() => document.querySelectorAll('button').length > 0);
  await page.waitForFunction(() => window.panelHarness.runtime.getState().runningByThreadId.alpha);
  await inputs.nth(1).press("Enter");
  await page.waitForFunction(() => window.panelHarness.runtime.getState().runningByThreadId.beta);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Both panel requests did not arrive")), 60000);
    notifyRequest = () => { if (requests.length >= 2) { clearTimeout(timer); resolve(); } };
    notifyRequest();
  });
  assert.equal(requests.length, 2);
  assert.equal(workspaceWrites.length, 0, "sending saved chats must preserve their own workspace bindings");
  assert.match(JSON.stringify(requests[0]), /model-a/); assert.match(JSON.stringify(requests[1]), /model-b/);
  assert.match(JSON.stringify(requests[0]), /Archivo exclusivo del panel alpha/);
  assert.doesNotMatch(JSON.stringify(requests[1]), /Archivo exclusivo del panel alpha/);
  await page.getByRole("button", {name: "Detener", exact: true}).first().click();
  assert.equal(await page.evaluate(() => window.panelHarness.runtime.getState().runningByThreadId.beta), true);
  releases.forEach(resolve => resolve());
  await page.getByText("PANEL_OK", {exact: true}).waitFor();
  await page.waitForFunction(() => !window.panelHarness.runtime.getState().runningByThreadId.beta);
  const original = JSON.stringify(messages.get("primary"));
  await page.getByRole("button", {name: "Opciones del panel", exact: true}).first().click();
  await page.getByRole("menuitem", {name: "Continuar en otro panel", exact: true}).click();
  await page.waitForFunction(() => window.panelHarness.store.getState().panes.length === 3);
  const copied = [...threads.values()].find(row => row.forkedFromThreadId === "primary");
  assert.ok(copied);assert.match(JSON.stringify(messages.get(copied.id)), /preparar Spartan/);
  const copiedContext = JSON.stringify(messages.get(copied.id));
  assert.match(copiedContext, /2 pruebas superadas/);
  assert.match(copiedContext, /plan.pdf/);
  assert.match(copiedContext, /Presupuesto registrado: 250/);
  assert.match(copiedContext, /https:\/\/example.org\/research/);
  assert.doesNotMatch(copiedContext, /DO_NOT_COPY|"type":"tool-call"/);
  assert.doesNotMatch(copiedContext, /<\/?tool_call>/);
  assert.equal(copied.settings.permissionMode, "ask");assert.equal(JSON.stringify(messages.get("primary")), original);
  const continuationReady = new Promise(resolve => { notifyRequest = resolve; });
  await inputs.nth(2).fill("Resume el estado de la tarea con las referencias copiadas.");
  await inputs.nth(2).press("Enter");
  await page.waitForFunction(id => window.panelHarness.runtime.getState().runningByThreadId[id], copied.id);
  await Promise.race([continuationReady, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Continuation request did not reach the simulated model")), 15000); timer.unref(); })]);
  assert.equal(requests.length, 3);
  const continuationPayload = JSON.stringify(requests.at(-1));
  assert.match(continuationPayload, /2 pruebas superadas/);
  assert.match(continuationPayload, /Presupuesto registrado: 250/);
  assert.doesNotMatch(continuationPayload, /DO_NOT_COPY/);
  assert.notEqual(requests.at(-1).bypass_permissions, true);
  assert.notEqual(requests.at(-1).confirm_tool_calls, false);
  releases.at(-1)();
  await page.waitForFunction(id => !window.panelHarness.runtime.getState().runningByThreadId[id], copied.id);
  await inputs.nth(0).fill("Borrador para conservar al cerrar");
  await page.getByRole("button", {name: "Cerrar panel",exact: true}).first().click();
  assert.ok(threads.has("alpha"), "closing a pane must preserve its saved conversation");
  await page.evaluate(() => window.panelHarness.open("alpha"));
  await page.getByRole("textbox", {name: "Escribe a este chat…"}).nth(2).waitFor();
  assert.equal(await page.getByRole("textbox", {name: "Escribe a este chat…"}).last().inputValue(), "Borrador para conservar al cerrar");
  assert.deepEqual(await page.evaluate(() => window.panelHarness.lifecycle), {mounts: 1, unmounts: 0});
  await page.screenshot({path: `${process.env.TEMP}/spartan-chat-panels.png`, animations: "disabled"});
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole("tablist", {name: "Paneles de chat"}).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("tab", {name: "Chat principal",exact: true}).click();
  await page.getByTestId("primary-message").waitFor();
  assert.ok((await page.getByTestId("primary-message").boundingBox()).width > 350, "the selected mobile chat must fill the available width");
  await page.screenshot({path: `${process.env.TEMP}/spartan-chat-panels-mobile.png`, animations: "disabled"});
  await page.getByRole("tab", {name: "alpha",exact: true}).click();
  const savedIds = await page.evaluate(() => window.panelHarness.store.getState().panes.map(pane => pane.thread.id));
  const sendsBeforeReload = requests.length;
  await page.reload({waitUntil: "domcontentloaded"});
  await page.waitForFunction(() => window.panelHarness?.store.getState().panes.length === 3 && !window.panelHarness.store.getState().restoringLayout);
  assert.deepEqual(await page.evaluate(() => window.panelHarness.store.getState().panes.map(pane => pane.thread.id)), savedIds);
  assert.equal(await page.getByRole("tab", {name: "alpha",exact: true}).getAttribute("aria-selected"), "true");
  await page.getByRole("textbox", {name: "Escribe a este chat…"}).last().waitFor();
  assert.equal(await page.getByRole("textbox", {name: "Escribe a este chat…"}).last().inputValue(), "Borrador para conservar al cerrar");
  assert.equal(requests.length, sendsBeforeReload, "restoring a layout must never send messages");
  threads.set("offline-panel", {...threads.get("alpha"), id: "offline-panel", title: "Offline panel"});
  offline = true;
  await page.evaluate(() => localStorage.setItem("spartan:chat-pane-layout:v1", JSON.stringify({version: 1, threadIds: ["alpha", "missing", "offline-panel"], focusedThreadId: "offline-panel"})));
  await page.reload({waitUntil: "domcontentloaded"});
  await page.getByRole("button", {name: "Reintentar",exact: true}).waitFor();
  const pendingLayout = await page.evaluate(() => JSON.parse(localStorage.getItem("spartan:chat-pane-layout:v1")));
  assert.deepEqual(pendingLayout.threadIds, ["alpha", "offline-panel"], "a confirmed missing chat is removed, a transport failure is retained");
  offline = false;
  await page.getByRole("button", {name: "Reintentar",exact: true}).click();
  await page.waitForFunction(() => window.panelHarness.store.getState().panes.length === 2 && !window.panelHarness.store.getState().restoringLayout);
  assert.equal(await page.getByRole("tab", {name: "Offline panel",exact: true}).getAttribute("aria-selected"), "true");
  assert.equal(requests.length, sendsBeforeReload);
  await page.evaluate(async () => {
    const store = window.panelHarness.store;
    store.setState({pendingRestoreIds: ["stale"]});
    let finish;
    const restoring = store.getState().restoreLayout(() => new Promise(resolve => {finish = resolve;}));
    window.dispatchEvent(new Event("unsloth:auth-session-cleared"));
    finish({id: "stale", title: "Stale", modelType: "base", archived: false, createdAt: 1});
    await restoring;
  });
  assert.equal(await page.evaluate(() => window.panelHarness.store.getState().panes.length), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("spartan:chat-pane-layout:v1")), null);
  assert.deepEqual(errors, []);
  console.log("Chat panels OK: independent sends/cancel, context copy, drafts, mobile tabs, reload restores order/focus without sends, missing chat removed, offline retry, logout invalidates pending restore");
} catch (error) { console.error(await debugPage?.evaluate(() => ({body: document.body.innerText.slice(0, 2400), textareas: [...document.querySelectorAll("textarea")].map(el => ({label: el.getAttribute("aria-label"), hidden: el.getAttribute("aria-hidden"), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height})), harness: !!window.panelHarness})).catch(() => null)); throw error; }
finally {releases.forEach(resolve => resolve());await browser?.close();await vite.close();}
