import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../desktop/frontend-spartan/", import.meta.url));
const requireFrontend = createRequire(root + "package.json");
const { createServer } = await import(pathToFileURL(requireFrontend.resolve("vite")).href);
const frameFile = fileURLToPath(new URL("../desktop/backend-spartan/routes/inference_pkg/router_artifacts.py", import.meta.url));
// Read the real frame constant without importing the backend or its ML runtime.
const frame = JSON.parse(execFileSync(process.platform === "win32" ? "py" : "python3", ["-c", "import ast,json,sys; tree=ast.parse(open(sys.argv[1],encoding='utf-8').read()); print(json.dumps(next(n.value.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='_ARTIFACT_PREVIEW_FRAME_HTML' for t in n.targets))))", frameFile], { encoding: "utf8" }));
const resources = {
  "index.HTML": '<!doctype html><link rel="stylesheet" href="css/main.css"><script defer src="js/main.js"></script><button id="counter">Count 0</button><img src="images/icon.svg">',
  "css/main.css": '@import "theme.css"; button { color: rgb(12, 34, 56); background-image:url("../images/icon.svg"); }',
  "css/theme.css": "button { border-radius: 13px; }",
  "js/main.js": 'document.querySelector("#counter").onclick = e => e.target.textContent = "Count 1";',
  "images/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/></svg>',
};
const server = await createServer({ root, configFile: root + "vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.addInitScript(() => { if (window.top === window) localStorage.setItem("unsloth_auth_token", "fixture-token"); });
  const errors = [];
  const downloads = [];
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  page.on("download", download => downloads.push(download.suggestedFilename()));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname.endsWith("artifact-preview-frame")) return route.fulfill({
      contentType: "text/html", body: frame,
      headers: { "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; sandbox allow-scripts" },
    });
    const prefix = "/api/inference/sandbox/fixture/";
    if (url.pathname.startsWith(prefix)) {
      assert.equal(route.request().headers().authorization, "Bearer fixture-token");
      assert.equal(url.searchParams.has("token"), false);
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      if (!(path in resources)) return route.fulfill({ status: 404, body: "missing" });
      return route.fulfill({ contentType: "application/octet-stream", headers: { "Content-Disposition": `attachment; filename="${path.split("/").pop()}"` }, body: resources[path] });
    }
    return route.fulfill({ json: { projects: [] } });
  });
  await page.route("https://example.test/new", route => route.fulfill({ contentType: "text/html", body: "<p>New URL target</p>" }));
  let finishStalledPage;
  const stalled = new Promise(resolve => { finishStalledPage = resolve; });
  await page.route("https://example.test/stalled", async route => {
    await stalled;
    return route.fulfill({ contentType: "text/html", body: "<p>Recovered page</p>" });
  });
  await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/source-files-harness.html", { timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector("main"), { timeout: 30_000 });
  assert.deepEqual(errors, []);
  await page.getByRole("button", { name: /: index.HTML$/ }).first().click();
  const preview = page.frameLocator('iframe[title="index.HTML"]');
  const counter = preview.getByRole("button", { name: "Count 0", exact: true });
  try { await counter.waitFor(); } catch (error) {
    console.error(await page.locator("main").innerText());
    console.error(await page.locator("iframe").evaluateAll(frames => frames.map(frame => ({ src: frame.src, title: frame.title }))));
    throw error;
  }
  assert.equal(await counter.evaluate(node => getComputedStyle(node).color), "rgb(12, 34, 56)");
  assert.equal(await counter.evaluate(node => getComputedStyle(node).borderRadius), "13px");
  assert.equal(await preview.locator("img").evaluate(async node => { await node.decode(); return node.naturalWidth; }), 12);
  // The parser can expose the button before its deferred script is attached.
  const previewFrame = await (await page.locator('iframe[title="index.HTML"]').elementHandle()).contentFrame();
  await previewFrame.waitForFunction(() => typeof document.querySelector("#counter")?.onclick === "function");
  await counter.click();
  assert.equal(
    await preview.locator("#counter").textContent(),
    "Count 1",
    "the bundled HTML script should update its button after a click",
  );
  assert.equal(await preview.locator("body").evaluate(() => { try { void parent.document.body; return false; } catch { return true; } }), true);
  assert.deepEqual(downloads, [], "opening HTML must not trigger a download");
  await page.getByRole("button", { name: /: missing.html$/ }).first().click();
  await preview.getByRole("button", { name: "Count 1", exact: true }).waitFor();
  // Bundling failures must not replace an existing valid artifact.
  const checks = await page.evaluate(async () => {
    const bundle = window.buildSandboxPreview;
    const run = async files => { try { await bundle("index.html", async name => { if (!(name in files)) throw new Error("missing"); return new Blob([files[name]]); }); return false; } catch { return true; } };
    return Promise.all([
      run({ "index.html": '<link rel="stylesheet" href="missing.css">' }),
      run({ "index.html": '<link rel="stylesheet" href="a.css">', "a.css": '@import "a.css";' }),
      run({ "index.html": '<script type="module" src="app.js"></script>', "app.js": 'import "./other.js";' }),
      run({ "index.html": "x".repeat(25 * 1024 * 1024 + 1) }),
      run({ "index.html": '<img src="../escape.png">' }),
    ]);
  });
  assert.deepEqual(checks, [true, true, true, true, true]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: root + "../../docs/audits/source-files-preview.png" });
  await page.getByRole("button", { name: "Open URL", exact: true }).click();
  await page.frameLocator("iframe").getByText("New URL target").waitFor();
  assert.equal(await page.locator("iframe").count(), 1, "opening the browser closes the canvas");
  assert.equal(await page.locator("iframe").getAttribute("srcdoc"), null);
  await page.getByRole("button", { name: /: index.HTML$/ }).first().click();
  await preview.getByRole("button", { name: "Count 0", exact: true }).waitFor();
  assert.equal(await page.locator("iframe").count(), 1, "opening a canvas closes the browser");
  await page.clock.install();
  await page.getByRole("button", { name: "Open stalled URL", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /Loading page|Cargando página/ }).waitFor();
  await page.clock.fastForward(16_000);
  await page.getByRole("alert").waitFor();
  await page.screenshot({ path: root + "../../docs/audits/browser-preview-timeout.png" });
  finishStalledPage();
  await page.frameLocator("iframe").getByText("Recovered page").waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "a late successful navigation clears the error state");
  assert.deepEqual(errors, []);
  console.log("Source file preview: HTML download route, CSS imports, JS, SVG, isolation, failure handling and URL navigation passed.");
} finally {
  await browser?.close();
  await server.close();
}
