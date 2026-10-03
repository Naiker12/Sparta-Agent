import { chromium } from "playwright";
const browser = await chromium.launch({headless:true, channel:"msedge", args:["--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets"]});
const page = await browser.newPage();
const errors = [];
const localRequests = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("request", request => { if (request.url().includes("/api/") && request.url().includes("__LOCALID_")) localRequests.push(request.url()); });
const url = "http://127.0.0.1:5173/mentions-smoke";
const source = await (await fetch("http://127.0.0.1:5173/desktop/frontend-spartan/src/features/chat/composer-mentions.tsx")).text();
const assistantUrl = source.match(/from "([^"]*@assistant-ui_react[^\"]*)"/)?.[1];
if (!assistantUrl) throw new Error("Could not resolve the shared assistant runtime");
const html = `<meta charset="utf-8"><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
</script>
<script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {AssistantRuntimeProvider,useLocalRuntime,ComposerPrimitive} from '${assistantUrl}';
import {ComposerMentions} from '/desktop/frontend-spartan/src/features/chat/composer-mentions.tsx';
import {withRunErrorStatus} from '/desktop/frontend-spartan/src/features/chat/utils/run-error-status.ts';
import '/desktop/frontend-spartan/src/index.css';
function App(){
 const runtime=useLocalRuntime(withRunErrorStatus({async *run(){yield {content:[{type:'text',text:'Respuesta parcial'}]};throw new Error('Fallo de conexión de prueba');}}));
 window.lastMessage=()=>runtime.thread.getState().messages.at(-1);
 const [thread,setThread]=React.useState('__LOCALID_first'); window.switchChat=()=>setThread('__LOCALID_'+Math.random());
 return React.createElement(AssistantRuntimeProvider,{runtime},React.createElement(ComposerPrimitive.Unstable_TriggerPopoverRoot,null,
 React.createElement(ComposerPrimitive.Root,{className:'relative m-10'},React.createElement(ComposerPrimitive.Input,{'aria-label':'Mensaje'}),React.createElement(ComposerMentions,{threadId:thread}))));
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));
</script>`;
try {
  await page.route(url, route=>route.fulfill({contentType:"text/html",body:html}));
  await page.route("**/api/**", route=>{
    const path=new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    return route.fulfill({json:path.includes('/skills') ? [{id:'test',name:'Prueba',description:'Contexto de prueba',tags:[]}] : path.includes('/mcp') ? {servers:[]} : {projects:[],documents:[]}});
  });
  await page.goto(url);
  const input = page.getByRole('textbox',{name:'Mensaje'});
  await input.waitFor();
  for(let index=0;index<12;index++){
    await input.fill('@');
    await page.getByRole('listbox').waitFor();
    await input.fill('hola');
    await page.evaluate(()=>window.switchChat());
  }
  await input.fill('@');
  await page.getByRole('listbox').waitFor();
  await input.fill('Prueba de generación');
  await input.press('Enter');
  await page.waitForFunction(()=>window.lastMessage()?.status?.reason==='error');
  const failed = await page.evaluate(()=>window.lastMessage());
  if (failed.status.error !== 'Fallo de conexión de prueba' || failed.content[0]?.text !== 'Respuesta parcial') throw new Error('Run error lost its message or partial response');
  if(localRequests.length) throw new Error('Provisional threads reached the backend: '+localRequests.join(','));
  if(errors.length) throw new Error(errors.join('\n'));
  console.log('Chat console OK: StrictMode, mentions, chat switches, provisional read guards, failed run retains partial response and inline error, no browser errors');
} catch(error) {
  console.error(errors.join('\n'));
  throw error;
} finally {await browser.close();}
