import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'

async function testStdio(config: Record<string, unknown>): Promise<{ ok: boolean; tools?: unknown[]; toolCount?: number; error?: string }> {
  const command = config.command as string
  const args = (config.args as string[]) ?? []

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(config.env as Record<string, string> ?? {}) },
      windowsHide: true,
    })

    let buffer = ''
    let initialized = false
    const timer = setTimeout(() => {
      proc.kill(); resolve({ ok: false, error: 'Timeout — el servidor MCP no respondió en 60s' })
    }, 61_000)

    function tryProcessLine(line: string) {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const msg = JSON.parse(trimmed)
        if (!initialized && msg.id === 1) {
          initialized = true
          proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
          proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n')
        } else if (msg.id === 2) {
          clearTimeout(timer)
          proc.kill()
          const tools = msg.result?.tools ?? []
          resolve({ ok: true, tools, toolCount: tools.length })
        } else if (msg.error) {
          clearTimeout(timer)
          proc.kill()
          resolve({ ok: false, error: msg.error.message ?? 'Error del servidor MCP' })
        }
      } catch { /* incomplete JSON, buffer more */ }
    }

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) tryProcessLine(line)
    })
    proc.stderr?.on('data', () => {})
    proc.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, error: err.message }) })
    proc.on('exit', (code) => {
      if (!initialized) { clearTimeout(timer); resolve({ ok: false, error: `El proceso terminó con código ${code}` }) }
    })

    proc.stdin?.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sparta-test', version: '1.0' } },
    }) + '\n')
  })
}

async function testHttp(config: Record<string, unknown>): Promise<{ ok: boolean; tools?: unknown[]; toolCount?: number; error?: string }> {
  const url = config.url as string
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers as Record<string, string> ?? {}) }

  try {
    const initResp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sparta-test', version: '1.0' } },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    await initResp.json()

    const toolsResp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await toolsResp.json() as { result?: { tools?: unknown[] }; error?: { message: string } }
    if (data.error) return { ok: false, error: data.error.message }
    const tools = data.result?.tools ?? []
    return { ok: true, tools, toolCount: tools.length }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export function registerMcpTestIPC(): void {
  ipcMain.handle('mcp:test', async (_event, config: Record<string, unknown>) => {
    if ((config.type as string) === 'http') return testHttp(config)
    return testStdio(config)
  })
}
