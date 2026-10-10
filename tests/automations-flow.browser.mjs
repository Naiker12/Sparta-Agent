// Exercises real React/Radix controls against a simulated task API; no provider calls.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const frontendRequire = createRequire(root + "package.json");
const { createServer } = await import(pathToFileURL(frontendRequire.resolve("vite")).href);
const server = await createServer({ root, configFile: root + "vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Browser error:", error.message); });
  page.on("console", message => { if (message.type() === "error") console.error("Browser console:", message.text()); });
  let task, activations = 0, manualTests = 0;
  let notificationEvents = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url()).pathname;
    if (!url.startsWith("/api/")) return route.continue();
    if (url === "/api/tasks/notifications") return route.fulfill({ json: { subject: "browser-notification-test", active: true, events: notificationEvents } });
    if (url === "/api/chat/projects") return route.fulfill({ json: { projects: [] } });
    if (url === "/api/tasks/delivery-destination") return route.fulfill({ json: { accountId: null } });
    if (url === "/api/tasks" && request.method() === "GET") return route.fulfill({ json: { tasks: task ? [task] : [] } });
    if (url === "/api/tasks" && request.method() === "POST") {
      task = { ...request.postDataJSON(), id: "task", nextRunAt: null, runs: [] };
      assert.equal(task.enabled, false);
      return route.fulfill({ json: task });
    }
    if (url === "/api/tasks/task/activate") {
      task = { ...task, ...request.postDataJSON(), enabled: true, automaticConsent: true, status: "scheduled", nextRunAt: Date.now() + 60000 };
      activations++;
      return route.fulfill({ json: task });
    }
    if (url === "/api/tasks/task/agent-test") {
      manualTests++;
      task = { ...task, runs: [{ id: "manual-test", status: "completed", startedAt: Date.now(), output: "Manual test result" }] };
      return route.fulfill({ json: task });
    }
    if (url === "/api/tasks/task") return route.fulfill({ json: task });
    return route.fulfill({ json: {} });
  });
  const origin = server.resolvedUrls.local[0];
  const fixture = origin + "tests/fixtures/automations-harness.html";
  await page.goto(fixture);
  await page.getByRole("button", { name: "Nueva automatización", exact: true }).click();
  await page.locator("#task-title").fill("Scheduled report");
  await page.locator("#task-prompt").fill("Summarize the report");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#task-minutes").fill("1");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Guardar y activar", exact: true }).isDisabled(), true);
  await page.locator("#task-provider").click();
  await page.getByRole("option", { name: "Test API", exact: true }).click();
  await page.locator("#task-model").click();
  await page.getByRole("option", { name: "scheduled-model", exact: true }).click();
  await page.getByRole("button", { name: "Guardar y activar", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  assert.equal(activations, 0, "saving must still wait for activation consent");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Probar agente con estos permisos", exact: true }).click();
  await page.getByText("Manual test result", { exact: true }).waitFor();
  assert.equal(manualTests, 1);
  assert.equal(task.enabled, false, "a successful manual test must not activate the schedule");
  await page.getByRole("button", { name: "Activar horario…", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar activación", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page.getByRole("combobox", { name: "Modelo", exact: true }).waitFor();
  assert.equal(activations, 1);
  assert.equal(task.model, "scheduled-model");
  await page.reload();
  await page.getByRole("button", { name: /Scheduled report/ }).click();
  await page.locator("#preview-model").getByText("scheduled-model", { exact: true }).waitFor();
  await page.locator("#preview-model").click();
  await page.getByRole("option", { name: "replacement-model", exact: true }).click();
  await page.getByRole("button", { name: "Actualizar modelo del horario", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar activación", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page.getByRole("combobox", { name: "Modelo", exact: true }).waitFor();
  assert.equal(task.model, "replacement-model");
  await page.goto(fixture + "?notifications=1");
  await page.getByTestId("location").waitFor();
  notificationEvents = [{ id: "research:started", status: "started", threadId: "automation-research", projectId: "research-project", finishedAt: Date.now(), notify: false }];
  await page.waitForFunction(() => {
    const location = document.querySelector('[data-testid="location"]')?.textContent;
    return location?.includes("thread=automation-research") && location.includes("project=research-project");
  });
  // Finished events update history without reopening a chat the user left.
  notificationEvents.push({ id: "research:finished", status: "completed", threadId: "automation-research", projectId: "research-project", finishedAt: Date.now(), notify: false });
  const previousActivations = activations;
  task = undefined;
  await page.goto(fixture + "?proposal=1");
  await page.getByRole("button", {name:"Revisar y programar",exact:true}).click();
  assert.equal(await page.locator("#task-title").inputValue(), "Daily research");
  assert.equal(task, undefined, "opening a proposal must not create a task");
  await page.getByRole("button", {name:"Continuar",exact:true}).click();
  await page.getByRole("button", {name:"Continuar",exact:true}).click();
  await page.locator("#task-provider").click();
  await page.getByRole("option", {name:"Test API",exact:true}).click();
  await page.locator("#task-model").click();
  await page.getByRole("option", {name:"scheduled-model",exact:true}).click();
  await page.getByRole("button", {name:"Guardar y activar",exact:true}).click();
  await page.getByRole("alertdialog").waitFor();
  assert.equal(task.enabled, false);
  assert.equal(activations, previousActivations);
  assert.equal(task.timezone,"America/Bogota");
  assert.deepEqual(task.weekdays,[0,1,2,3,4]);
  await page.getByRole("button",{name:"Confirmar activación",exact:true}).click();
  await page.getByRole("alertdialog").waitFor({state:"hidden"});
  assert.equal(task.enabled,true);
  assert.equal(activations,previousActivations+1);
  await page.goto(fixture + "?composer=1");
  await page.getByPlaceholder("Task instructions").fill("Research tomorrow's report");
  await page.locator('[data-tour="chat-plus-menu"]').click();
  await page.getByRole("menuitem", {name:"Programar tarea",exact:true}).click();
  await page.locator("#task-prompt").waitFor();
  assert.equal(await page.locator("#task-prompt").inputValue(), "Research tomorrow's report");
  await page.getByRole("button", {name:"Cancelar",exact:true}).click();
  await page.locator("#task-prompt").waitFor({state:"hidden"});
  assert.equal(await page.getByPlaceholder("Task instructions").inputValue(), "Research tomorrow's report");
  assert.deepEqual(errors, []);
  console.log("Automation browser flow passed: activation, saved model, execution chat and conversational plan review with explicit consent.");
} catch (error) {
  console.error("Automation UI at failure:", await page?.locator("body").innerText());
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
