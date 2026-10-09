import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron } from 'playwright';

const root = process.cwd();
const frontend = path.join(root, 'desktop/frontend-spartan');
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { build } = requireFrontend('esbuild');
const JSZip = requireFrontend('jszip');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'spartan-word-render-'));
let app;
let page;
const errors = [];
try {
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {WordPreview} from './src/features/rag/components/word-preview'; window.renderWord=(bytes)=>createRoot(document.getElementById('root')).render(<WordPreview blob={new Blob([new Uint8Array(bytes)])}/>);`, resolveDir: frontend, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    alias: {'@': path.join(frontend, 'src')}, define: {'import.meta.env.DEV': 'false'},
  });
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Spartan test document</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Second page</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>');
  const bytes = process.argv[2] ? await fs.readFile(path.resolve(process.argv[2])) : await zip.generateAsync({type:'nodebuffer'});
  await fs.writeFile(path.join(temporary, 'main.cjs'), `const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary,'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:900,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false}});w.loadURL('data:text/html,<html><body style="margin:0"><div id="root" style="height:850px"></div></body></html>');});`);
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  app = await _electron.launch({args:[path.join(temporary,'main.cjs')],env,timeout:30000});
  page = await app.firstWindow();
  await page.waitForURL(/^data:text\/html/);
  await page.waitForLoadState('domcontentloaded');
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if(message.type()==='error' && message.text().includes('Spartan Word preview')) errors.push(message.text()); });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(bytes => window.renderWord(bytes), Array.from(bytes));
  const document = page.frameLocator('iframe');
  await document.locator('section.docx').first().waitFor({timeout:10000});
  const pages = await document.locator('section.docx').count();
  assert.ok(pages > 0);
  if(!process.argv[2]) assert.equal(pages, 2, 'explicit page breaks must survive rendering');
  assert.equal(await document.locator('section.docx').first().evaluate(node=>getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
  assert.deepEqual(errors, []);
  console.log(`Word viewer: ${pages} pages rendered in isolated Electron; white paper and page layout verified.`);
} catch(error) {
  console.error(JSON.stringify({errors, text: page ? await page.locator('#root').innerText() : '', frames: page ? await page.locator('iframe').count() : 0}));
  throw error;
} finally {
  await app?.close();
  const resolved = path.resolve(temporary);
  if(path.dirname(resolved)!==path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('spartan-word-render-')) throw new Error('Unexpected temporary path');
  await fs.rm(resolved,{recursive:true,force:true});
}
