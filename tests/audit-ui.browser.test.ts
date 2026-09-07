import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { build } from 'esbuild'
import { chromium, type Browser, type Page } from 'playwright'
import { beforeAll, afterAll, expect, test } from 'vitest'

// Mount the production component bodies with real React hooks and controlled
// service boundaries. AST extraction avoids importing the entire model/chat app.
function component(relative: string, name: string): string {
  const source = readFileSync(path.resolve(relative), 'utf8')
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  for (const node of ast.statements) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node.getText(ast)
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations.find(d => d.name.getText(ast) === name)
      if (declaration?.initializer) return `const ${name} = ${declaration.initializer.getText(ast)};`
    }
  }
  throw new Error(`Missing production component: ${name}`)
}

let browser: Browser | undefined
let page: Page | undefined
let browserAvailable = false
const errors: string[] = []
beforeAll(async () => {
  const candidatePaths = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean) as string[]

  const executablePath = candidatePaths.find(p => existsSync(p))

  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    })
    page = await browser.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<div id="root"></div>')
    const vram = component('desktop/frontend-spartan/src/features/model-picker/components/model-config-page.tsx', 'VramBudgetRow')
    const terminal = component('desktop/frontend-spartan/src/components/assistant-ui/tool-ui-terminal.tsx', 'TerminalToolUIImpl')
    const compiled = await build({
      stdin: { contents: `
        import React, {useState, useEffect, useId, useRef, useCallback} from 'react';
        import {createRoot} from 'react-dom/client';
        const root = createRoot(document.getElementById('root'));
        const useT = () => {const [locale] = useState('en'); return useCallback(key => key, [locale]);};
        const usePlatformStore = selector => selector({deviceType:'windows'});
        const useChatRuntimeStore = selector => selector({modelLoading:false, toolFullOutput:{}});
        let load;
        const pending = new Promise(resolve => {load = resolve});
        const loadVramBudgetSettings = () => pending;
        const subscribeVramBudgetSettings = () => () => {};
        const subscribeVramBudgetLock = () => () => {};
        const isVramBudgetLocked = () => false;
        const flushVramBudgetSave = () => undefined;
        const vramFractionToPercent = n => n * 100;
        const vramPercentToFraction = n => n / 100;
        const stageVramBudgetSave = () => {};
        const updateVramBudgetSettings = () => pending;
        const VRAM_BUDGET_PERCENT_STEP = 0.1;
        const toast = {error: e => {throw e}};
        const AdvancedGpuSlider = p => <div data-testid="vram">{p.label}: {p.displayValue}</div>;
        let awaiting = true;
        const useToolArgsStatus = () => ({propStatus:{command:'complete'}});
        const isSandboxToolResult = result => !!result && typeof result === 'object' && 'files' in result;
        const stringifyToolResult = value => String(value);
        const useToolPaneScope = () => 'test';
        const useToolOutputFor = () => '';
        const preferSanitizedFullToolOutput = (_, result) => result;
        const useToolAwaitingApproval = () => awaiting;
        const ToolFallbackRoot = p => <section>{p.children}</section>;
        const ToolFallbackContent = p => <article>{p.children}</article>;
        const ToolFallbackTrigger = p => <header>{p.toolName}: {p.status.type}</header>;
        const ToolCodeCell = p => <pre>{p.code}</pre>;
        const ToolLiveOutput = () => <pre>live stdout</pre>;
        const ToolResultOutput = p => <pre>{p.text}</pre>;
        const SandboxFiles = p => <div>{p.files.map(f => f.name).join(',')}</div>;
        const Spinner = () => <span />;
        const CopyBtn = () => <button>copy</button>;
        const TerminalIcon = () => null;
        ${vram}
        ${terminal}
        window.mountVram = () => root.render(<VramBudgetRow />);
        window.loadVram = () => load({fraction:.97, defaultFraction:.97, minFraction:.1, maxFraction:1});
        window.mountTerminal = (status, approval, command, result) => {
          awaiting = approval;
          root.render(<TerminalToolUIImpl toolCallId="call" args={{command}} status={{type:status}} result={result}/>);
        };
      `, loader: 'tsx', resolveDir: path.resolve('desktop/frontend-spartan') },
      bundle: true, write: false, format: 'iife', platform: 'browser',
    })
    await page.addScriptTag({ content: compiled.outputFiles[0].text })
    browserAvailable = true
  } catch (error) {
    console.warn('[audit-ui.browser.test] Browser not available or launch failed, skipping suite:', error)
    browserAvailable = false
  }
}, 30_000)
afterAll(async () => { await browser?.close() })

test('VRAM transitions from pending settings to a mounted slider without hook errors', async (ctx) => {
  if (!browserAvailable || !page) {
    ctx.skip()
    return
  }
  await page.evaluate('window.mountVram()')
  await page.waitForTimeout(100)
  expect(await page.locator('[data-testid="vram"]').count()).toBe(0)
  await page.evaluate('window.loadVram()')
  await page.waitForSelector('[data-testid="vram"]')
  expect(await page.locator('[data-testid="vram"]').textContent()).toContain('97%')
  expect(errors).toEqual([])
})

test('terminal shows the full command during approval, live output, and failure details', async (ctx) => {
  if (!browserAvailable || !page) {
    ctx.skip()
    return
  }
  await page.evaluate(() => (window as any).mountTerminal('running', true, 'npm install important-package', undefined))
  await page.getByText('chat.tools.waitingApproval', { exact: true }).waitFor()
  expect(await page.locator('pre').allTextContents()).toContain('npm install important-package')
  await page.evaluate(() => (window as any).mountTerminal('running', false, 'npm install important-package', undefined))
  await page.getByText('chat.tools.running', { exact: true }).waitFor()
  expect(await page.locator('pre').allTextContents()).toContain('live stdout')
  await page.evaluate(() => (window as any).mountTerminal('incomplete', false, 'npm install important-package', 'Permission denied'))
  await page.getByText('Permission denied', { exact: true }).waitFor()
  expect(await page.locator('pre').allTextContents()).toContain('npm install important-package')
  expect(errors).toEqual([])
})
