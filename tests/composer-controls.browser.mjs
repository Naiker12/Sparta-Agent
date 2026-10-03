// Browser verification of the actual composer controls with a simulated provider.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(20_000);
const url = "http://127.0.0.1:5173/composer-smoke";
// Follow Vite's current HMR module URL so the fixture and controls share one store.
const toggleSource = await (await fetch("http://127.0.0.1:5173/desktop/frontend-spartan/src/components/assistant-ui/thread/reasoning-toggle.tsx")).text();
const runtimeUrl = toggleSource.match(/from "([^"]*chat-runtime-store\.ts[^\"]*)"/)?.[1];
if (!runtimeUrl) throw new Error("Could not resolve the composer runtime store");
const html = `<meta charset="utf-8"><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
</script>
<script type="module">
import React from '/node_modules/.vite/deps/react.js'; import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import '/desktop/frontend-spartan/src/index.css';
import {setLocale} from '/desktop/frontend-spartan/src/i18n/index.ts';
import {ApiProviderModelSelector} from '/desktop/frontend-spartan/src/features/chat/components/api-provider-model-selector.tsx';
import {ReasoningToggle} from '/desktop/frontend-spartan/src/components/assistant-ui/thread/reasoning-toggle.tsx';
import {ThreadWorkspaceChip} from '/desktop/frontend-spartan/src/features/chat/components/thread-workspace-chip.tsx';
import {PermissionModeComposerPill} from '/desktop/frontend-spartan/src/features/chat/permission-mode-select.tsx';
import {useChatRuntimeStore as runtime} from '${runtimeUrl}';
import {useExternalProvidersStore as connections} from '/desktop/frontend-spartan/src/features/chat/stores/external-providers-store.ts';
import {buildExternalModelId} from '/desktop/frontend-spartan/src/features/chat/external-providers.ts';
import {getExternalReasoningCapabilities} from '/desktop/frontend-spartan/src/features/chat/provider-capabilities.ts';
import {Toaster} from '/node_modules/.vite/deps/sonner.js';
setLocale('es');
connections.getState().setConnectionsEnabled(true);
connections.getState().setProviders([{id:'test',providerType:'openrouter',name:'OpenRouter',baseUrl:'https://openrouter.ai/api/v1',models:['openrouter/free'],hasApiKey:true}]);
runtime.setState(s=>({params:{...s.params,checkpoint:buildExternalModelId('test','openrouter/free')}}));
window.getReasoning=()=>runtime.getState().reasoningEffort;
window.snapshot=()=>({checkpoint:runtime.getState().params.checkpoint, providers:connections.getState().providers,caps:getExternalReasoningCapabilities('openrouter','test/max')});
function App(){const value=runtime(s=>s.params.checkpoint);const [running,setRunning]=React.useState(false);window.setRunning=setRunning; return React.createElement('main',{className:'min-h-screen bg-background flex items-end justify-center p-4'},
React.createElement('form',{className:'w-full max-w-[48rem]',onSubmit:e=>{e.preventDefault();runtime.getState().setActiveThreadId('saved-ui-thread')}},React.createElement(ThreadWorkspaceChip,{isRunning:running}),React.createElement('section',{className:'chat-composer-surface rounded-3xl border bg-card p-4 shadow-lg'},
React.createElement('div',{className:'unsloth-composer-line'},React.createElement('textarea',{className:'unsloth-composer-input w-full',placeholder:'Pregunta lo que sea…','aria-label':'Mensaje'}),
React.createElement('div',{className:'unsloth-composer-left'},React.createElement('button',{'aria-label':'Adjuntar',className:'size-8 text-xl'},'+'),React.createElement(PermissionModeComposerPill,{side:'top'})),
React.createElement('div',{className:'aui-composer-action-wrapper order-3 flex items-center gap-1'},React.createElement(ApiProviderModelSelector,{models:[{id:buildExternalModelId('test','openrouter/free'),name:'openrouter/free',providerId:'test',providerName:'OpenRouter',providerType:'openrouter'}],value,onValueChange:id=>runtime.setState(s=>({params:{...s.params,checkpoint:id}})),onConfigureProviders:()=>{}}),React.createElement(ReasoningToggle,{side:'top'}),React.createElement('button',{className:'size-8','aria-label':'Dictar'},'♩'),React.createElement('button',{className:'size-8 rounded-full bg-primary text-primary-foreground','aria-label':'Enviar'},'↑'))))))}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(App),React.createElement(Toaster)));
</script>`;
try {
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("**/api/providers/models", route => route.fulfill({ json: [
    { id: "openrouter/free", display_name: "Free", reasoning: null },
    { id: "test/max", display_name: "Test max", reasoning: { supported_efforts: ["max", "high", "medium", "low"], mandatory: true } },
    { id: "test/limited", display_name: "Test limited", reasoning: { supported_efforts: ["low", "high"] } },
    { id: "openrouter:apodex-1.1-mini:free-long-model-for-layout", reasoning: { supported_efforts: ["low", "high"] } },
  ] }));
  let workspaceBinding = null;
  await page.route('**/api/chat/projects*', route => route.fulfill({json:{projects:[
    {id:'sparta',name:'sparta-agent',connectedFolderPath:'D:/sparta-agent',archived:false,updatedAt:2,createdAt:1},
    {id:'autem',name:'AUTEM',connectedFolderPath:'D:/AUTEM',archived:false,updatedAt:1,createdAt:1}
  ]}}));
  await page.route('**/api/chat/threads/saved-ui-thread/workspace', async route => {
    if(route.request().method()==='PUT') {
      const data = route.request().postDataJSON();
      workspaceBinding={threadId:'saved-ui-thread',bindingId:'test-binding',canonicalPath:data.folderPath,access:data.access};
    } else if(route.request().method()==='DELETE') {workspaceBinding=null;}
    await route.fulfill({json:workspaceBinding});
  });
  let saved = false;
  await page.route("**/api/providers/test", async route => {
    const body = route.request().postDataJSON();
    saved = body.models.includes("test/max");
    await route.fulfill({ json: { id: "test" } });
  });
  await page.goto(url);
  await page.getByRole('button',{name:'Trabajar en una carpeta',exact:true}).click();
  await page.getByPlaceholder('Buscar proyectos o carpetas…').fill('AUTEM');
  await page.getByRole('option',{name:'AUTEM',exact:true}).waitFor();
  if(await page.getByRole('option',{name:'sparta-agent',exact:true}).count()) throw new Error('Workspace search failed');
  await page.getByPlaceholder('Buscar proyectos o carpetas…').fill('sparta');
  await page.getByRole('option',{name:'sparta-agent',exact:true}).click();
  await page.getByRole('button',{name:'Conectar carpeta',exact:true}).click();
  await page.getByRole('button',{name:'sparta-agent',exact:true}).waitFor();
  await page.getByRole('button',{name:'sparta-agent',exact:true}).click();
  await page.screenshot({path:'artifacts/composer-workspace-menu.png'});
  await Promise.all([page.waitForResponse(r=>r.url().includes('/saved-ui-thread/workspace') && r.request().method()==='PUT'), page.evaluate(()=>document.querySelector('form').requestSubmit())]);
  await page.getByPlaceholder('Buscar proyectos o carpetas…').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('[aria-label="sparta-agent"]'));
  if(workspaceBinding?.canonicalPath!=='D:/sparta-agent' || workspaceBinding?.access!=='read') throw new Error('Sending lost workspace binding');
  await page.getByRole('button',{name:'sparta-agent',exact:true}).click();
  await page.evaluate(()=>window.setRunning(true));
  await page.getByPlaceholder('Buscar proyectos o carpetas…').waitFor({state:'detached'});
  if(!await page.getByRole('button',{name:'sparta-agent',exact:true}).isDisabled()) throw new Error('Workspace remained mutable during generation');
  await page.evaluate(()=>window.setRunning(false));
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.getByRole('button',{name:'sparta-agent',exact:true}).click();
  await page.screenshot({path:'artifacts/composer-workspace-dark.png',animations:'disabled'});
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  await page.getByRole("button", { name: "Seleccionar modelo", exact: true }).click();
  await page.getByRole("option", { name: "test/max", exact: true }).waitFor();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/composer-models.png", clip: { x: 130, y: 150, width: 700, height: 410 } });
  await page.getByPlaceholder("Buscar modelo o proveedor…").fill("test/max");
  if (await page.getByRole("option").count() !== 1) throw new Error("Catalog search did not filter models");
  await page.getByRole("option", { name: "test/max", exact: true }).click();
  if (!saved) throw new Error("A newly selected catalog model was not enabled on the backend");
  await page.getByRole("button", { name: /Esfuerzo de razonamiento:/ }).click();
  const slider = page.getByRole("slider", { name: "Esfuerzo de razonamiento" });
  await slider.focus();
  await slider.press("End");
  if (await page.evaluate(() => window.getReasoning()) !== "max") throw new Error("Maximum effort was not persisted");
  await page.screenshot({ path: "artifacts/composer-effort.png", clip: { x: 130, y: 220, width: 700, height: 340 } });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Seleccionar modelo", exact: true }).click();
  await page.getByRole("option", { name: "test/limited", exact: true }).click();
  await page.getByRole("button", { name: /Esfuerzo de razonamiento:/ }).click();
  await page.getByRole("slider", { name: "Esfuerzo de razonamiento" }).press("End");
  if (await page.evaluate(() => window.getReasoning()) !== "high") throw new Error("Unsupported maximum effort was offered on a limited model");
  await page.keyboard.press("Escape");
  await page.getByRole('button', {name:'Seleccionar modelo',exact:true}).click();
  await page.getByRole('option', {name:'openrouter:apodex-1.1-mini:free-long-model-for-layout',exact:true}).click();
  await page.getByPlaceholder('Buscar modelo o proveedor…').waitFor({state:'detached'});
  const wideFolder = await page.getByRole('button', {name:/sparta-agent/}).boundingBox();
  const longModel = await page.getByRole('button', {name:'Seleccionar modelo',exact:true}).boundingBox();
  if (wideFolder.y >= longModel.y || longModel.width > 180) throw new Error('Long model split the desktop toolbar');
  await page.screenshot({path:'artifacts/composer-unified-long-model.png'});
  await page.setViewportSize({ width: 600, height: 560 });
  const folder = page.getByRole('button', {name:/sparta-agent/});
  const folderBox = await folder.boundingBox();
  const modelBox = await page.getByRole('button', {name:'Seleccionar modelo',exact:true}).boundingBox();
  if (folderBox.y >= modelBox.y) throw new Error('Narrow workspace controls did not compact into the toolbar');
  await page.screenshot({path:'artifacts/composer-narrow.png'});
  await page.getByRole('button',{name:'Permission level for tool calls'}).click();
  await page.getByRole('menu').waitFor();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 560 });
  const mobileFolder = await folder.boundingBox();
  const mobileModel = await page.getByRole('button', {name:'Seleccionar modelo',exact:true}).boundingBox();
  if (mobileFolder.y >= mobileModel.y) throw new Error('Mobile toolbar split with a long model');
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Composer controls overflow the mobile viewport");
  await page.screenshot({path:'artifacts/composer-workspace-mobile.png'});
  await page.getByRole('button',{name:'sparta-agent',exact:true}).click();
  await page.getByRole('option',{name:'Trabajar sin carpeta',exact:true}).click();
  await page.getByRole('button',{name:'Trabajar en una carpeta',exact:true}).waitFor();
  if(workspaceBinding) throw new Error('Disconnect retained binding');
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Composer UI OK: workspace search, binding on send, generation lock, disconnect, responsive layout, remote catalog and reasoning");
} catch (error) {
  console.log(await page.locator('body').innerText());
  console.log(await page.evaluate(() => window.snapshot()));
  throw error;
} finally { await browser.close(); }
