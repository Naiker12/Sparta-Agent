// Real file:// + app.asar: HTTP browser tests cannot detect disk-path routing regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createPackage } from '@electron/asar';
import { _electron } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'desktop/frontend-spartan');
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { build } = requireFrontend('esbuild');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sparta-packaged-assets-'));
const renderer = path.join(directory, 'source/dist');
await fs.mkdir(renderer, {recursive:true});
// Model the renderer's two public directories just as the production build does.
await fs.cp(path.join(root,'public'), renderer,{recursive:true});
await fs.cp(path.join(frontend,'public'), renderer,{recursive:true});
const providers = (await fs.readdir(path.join(frontend,'public/provider-logos')))
  .filter(name=>/\.(svg|png|jpg)$/.test(name)).map(name=>name.replace(/\.[^.]+$/,''));
providers.push('openai_codex','local_llamacpp','local_ollama','local_lmstudio','local_vllm');
await build({entryPoints:[path.join(frontend,'tests/fixtures/packaged-assets.tsx')],
  outfile:path.join(renderer,'renderer.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',
  tsconfig:path.join(frontend,'tsconfig.app.json'),
  define:{'import.meta.env.BASE_URL':'"./"','process.env.NODE_ENV':'"production"',PROVIDERS:JSON.stringify(providers)},
});
await fs.writeFile(path.join(renderer,'index.html'),`<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'">
<div id="root"></div><script type="module" src="./renderer.js"></script>`);
const archive=path.join(directory,'app.asar');
await createPackage(path.join(directory,'source'),archive);
await fs.writeFile(path.join(directory,'main.cjs'),`
const {app,BrowserWindow}=require('electron');
app.setPath('userData',${JSON.stringify(path.join(directory,'profile'))});
app.whenReady().then(()=>{const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,sandbox:true}});win.loadFile(${JSON.stringify(path.join(archive,'dist/index.html'))});});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
 app=await _electron.launch({args:[...(process.platform==='linux'?['--no-sandbox']:[]),path.join(directory,'main.cjs')],env,timeout:30000});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForURL(/^file:/);await page.locator('[data-provider]').first().waitFor();
 const documentPath=new URL(page.url()).pathname;
 const probe=expression=>page.evaluate(expression);
 async function assertLogos(){
   const images=page.locator('[data-provider] img');await images.first().waitFor();
   await page.waitForFunction(count=>{const images=[...document.querySelectorAll('[data-provider] img')];return images.length===count&&images.every(img=>img.complete&&img.naturalWidth>0);},providers.length);
   assert.equal(new URL(page.url()).pathname,documentPath,'navigation must preserve the installed document');
 }
 await assertLogos();
 for (const provider of ['openai','openai_codex','ollama','local_ollama']) {
   assert.ok((await page.locator(`[data-provider="${provider}"] img`).getAttribute('class')).includes('dark:invert'), `${provider} must remain visible in dark mode`);
 }
 await probe(()=>window.assetProbe.navigate('/chat?thread=A&project=p1'));
 await page.waitForURL('**#/chat?thread=A&project=p1');await assertLogos();
 assert.equal(await probe(()=>window.assetProbe.read()),'/chat?thread=A&project=p1');
 await page.reload();await assertLogos();
 await probe(()=>window.assetProbe.navigate('/settings'));await page.waitForURL('**#/settings');await assertLogos();
 await probe(()=>window.assetProbe.back());await page.waitForURL('**#/chat?thread=A&project=p1');
 await probe(()=>window.assetProbe.anchor());await page.waitForURL('**#details');
 assert.equal(await probe(()=>window.assetProbe.read()),'/chat?thread=A&project=p1#details');
 const beforeAuth=await probe(()=>window.assetProbe.bootId);
 await probe(()=>window.assetProbe.auth());await page.waitForURL('**#/login');
 await page.waitForFunction(previous=>window.assetProbe?.bootId&&window.assetProbe.bootId!==previous,beforeAuth);
 await assertLogos();
 await page.reload();await assertLogos();
 assert.deepEqual(errors,[]);
 console.log(`Packaged file navigation passed: ${providers.length} provider logos, navigation, back, reload, thread query, anchors and auth redirect.`);
} finally {if(app)await app.close();await fs.rm(directory,{recursive:true,force:true});}
