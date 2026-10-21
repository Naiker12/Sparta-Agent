import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { chromium } from "playwright";

// Point this at a running desktop backend. The preview shell is public and
// contains no session data, so the regression needs no credentials.
const backend = process.argv[2] || process.env.SPARTA_TEST_BACKEND_URL;
assert.ok(backend, "Pass the running backend URL as the first argument or SPARTA_TEST_BACKEND_URL");
const frameUrl = new URL("/api/inference/artifact-preview-frame?v=live-probe", backend).href;
const response = await fetch(frameUrl);
assert.equal(response.status, 200);
const productionCsp = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)?.[0];
assert.ok(productionCsp);
const html = '<!doctype html><html><head><style>body{font-family:system-ui;padding:24px}h1{color:rgb(12,34,56)}</style></head><body><h1>HTML del backend real</h1><button id="counter">Count 0</button><script>document.querySelector("#counter").onclick=e=>e.target.textContent="Count 1";</script></body></html>';
const server = http.createServer((request, reply) => {
  if (request.url === "/probe.js") {
    reply.writeHead(200, { "Content-Type": "text/javascript" });
    reply.end(`const frame=document.querySelector('iframe'); const send=()=>frame.contentWindow.postMessage({type:'unsloth:artifact-html', html:${JSON.stringify(html)}}, '*'); frame.addEventListener('load', send); send();`);
  } else {
    reply.writeHead(200, { "Content-Type": "text/html" });
    reply.end(`<!doctype html><html><head>${productionCsp}</head><body><iframe title="Live preview" sandbox="allow-scripts" src="${frameUrl}" style="width:100%;height:500px;border:0"></iframe><script src="/probe.js"></script></body></html>`);
  }
});
let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const preview = page.frameLocator("iframe");
  await preview.getByRole("heading", { name: "HTML del backend real" }).waitFor();
  assert.equal(await preview.locator("h1").evaluate(node => getComputedStyle(node).color), "rgb(12, 34, 56)");
  await preview.getByRole("button", { name: "Count 0", exact: true }).click();
  await preview.getByRole("button", { name: "Count 1", exact: true }).waitFor();
  assert.equal(await preview.locator("body").evaluate(() => { try { void parent.document.body; return false; } catch { return true; } }), true);
  assert.deepEqual(errors, []);
  console.log("Live backend HTML, CSS and JavaScript render under the production parent CSP; frame remains isolated.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
