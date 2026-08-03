/**
 * McpProcessManager.ts
 * Gestor Singleton de procesos y sesiones MCP persistentes en segundo plano.
 * Mantiene vivos los subprocesos STDIO durante la sesión del usuario para llamadas de tools instantáneas.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import os from 'node:os'
import { JsonRpcStreamParser, type JsonRpcMessage } from './JsonRpcStreamParser'
import { getEnhancedEnv } from './mcp-path-fix'

export interface MCPToolSchema {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
}

export interface McpSession {
  serverId: string
  config: Record<string, unknown>
  proc?: ChildProcess
  tools: MCPToolSchema[]
  connected: boolean
  lastError?: string
  nextRequestId: number
  pendingRequests: Map<number | string, PendingRequest>
}

export class McpProcessManager {
  private static instance: McpProcessManager
  private sessions = new Map<string, McpSession>()

  public static getInstance(): McpProcessManager {
    if (!McpProcessManager.instance) {
      McpProcessManager.instance = new McpProcessManager()
    }
    return McpProcessManager.instance
  }

  /**
   * Asegura que el servidor MCP especificado esté iniciado y conectado.
   */
  public async ensureConnected(config: Record<string, unknown>): Promise<{ ok: boolean; tools: MCPToolSchema[]; error?: string }> {
    const serverId = (config.id as string) || (config.name as string) || 'default'
    const existing = this.sessions.get(serverId)

    if (existing && existing.connected && existing.proc && !existing.proc.killed) {
      return { ok: true, tools: existing.tools }
    }

    if (existing) {
      this.disconnect(serverId)
    }

    const isHttp = config.type === 'http'
    if (isHttp) {
      return this.connectHttp(serverId, config)
    }

    return this.connectStdio(serverId, config)
  }

  private connectStdio(serverId: string, config: Record<string, unknown>): Promise<{ ok: boolean; tools: MCPToolSchema[]; error?: string }> {
    const command = config.command as string
    let args = (config.args as string[]) ?? []

    if (serverId === 'filesystem' || args.some((a) => a.includes('server-filesystem'))) {
      const homeDir = os.homedir()
      const userProfile = process.env.USERPROFILE || homeDir
      const pathsToAdd = [homeDir, userProfile, process.cwd()].filter(Boolean)
      const existingPaths = args.filter((a) => !a.startsWith('-'))
      for (const p of pathsToAdd) {
        if (!existingPaths.includes(p)) {
          args.push(p)
        }
      }
    }

    if (!command) {
      return Promise.resolve({ ok: false, tools: [], error: 'El servidor STDIO no especifica un comando ejecutable' })
    }

    return new Promise((resolve) => {
      try {
        const env = getEnhancedEnv(config.env as Record<string, string>)
        const isWin = process.platform === 'win32'
        const commandToSpawn = isWin && ['npx', 'npm', 'pnpm', 'uvx', 'yarn'].includes(command.toLowerCase())
          ? `${command}.cmd`
          : command

        const proc = spawn(commandToSpawn, args, {
          stdio: ['pipe', 'pipe', 'pipe'] as const,
          env: env as NodeJS.ProcessEnv,
          windowsHide: true,
          shell: isWin,
        })

        const parser = new JsonRpcStreamParser()
        const session: McpSession = {
          serverId,
          config,
          proc,
          tools: [],
          connected: false,
          nextRequestId: 1,
          pendingRequests: new Map(),
        }

        this.sessions.set(serverId, session)

        const initTimer: NodeJS.Timeout | undefined = setTimeout(() => {
          this.disconnect(serverId)
          resolve({ ok: false, tools: [], error: `Timeout al conectar con el servidor MCP "${serverId}" (60s)` })
        }, 60_000)

        const handleMessage = (msg: JsonRpcMessage) => {
          if (msg.id !== undefined && session.pendingRequests.has(msg.id)) {
            const pending = session.pendingRequests.get(msg.id)!
            session.pendingRequests.delete(msg.id)
            clearTimeout(pending.timer)

            if (msg.error) {
              pending.reject(new Error(msg.error.message || 'Error en servidor MCP'))
            } else {
              pending.resolve(msg.result)
            }
            return
          }

          if (msg.id === 1 && !session.connected) {
            proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
            this.sendRequest(session, 'tools/list', {})
              .then((result) => {
                if (initTimer) clearTimeout(initTimer)
                const res = result as { tools?: MCPToolSchema[] }
                const tools = res?.tools ?? []
                session.tools = tools
                session.connected = true
                resolve({ ok: true, tools })
              })
              .catch((err) => {
                if (initTimer) clearTimeout(initTimer)
                this.disconnect(serverId)
                resolve({ ok: false, tools: [], error: (err as Error).message })
              })
          }
        }

        proc.stdout?.on('data', (chunk: Buffer) => {
          const messages = parser.parseChunk(chunk)
          for (const msg of messages) {
            handleMessage(msg)
          }
        })

        proc.stderr?.on('data', () => {})

        proc.on('error', (err: Error) => {
          if (initTimer) clearTimeout(initTimer)
          this.disconnect(serverId)
          resolve({ ok: false, tools: [], error: `Error de spawn: ${err.message}` })
        })

        proc.on('exit', (code: number | null) => {
          if (!session.connected) {
            if (initTimer) clearTimeout(initTimer)
            resolve({ ok: false, tools: [], error: `El proceso MCP terminó con código ${code}` })
          }
          this.disconnect(serverId)
        })

        proc.stdin?.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'sparta-agent', version: '2.0.0' },
          },
        }) + '\n')

      } catch (err) {
        resolve({ ok: false, tools: [], error: (err as Error).message })
      }
    })
  }

  private async connectHttp(serverId: string, config: Record<string, unknown>): Promise<{ ok: boolean; tools: MCPToolSchema[]; error?: string }> {
    const url = config.url as string
    if (!url) return { ok: false, tools: [], error: 'El servidor HTTP no especifica URL' }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> ?? {}),
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sparta-agent', version: '2.0.0' } },
        }),
        signal: AbortSignal.timeout(15_000),
      })

      const toolsResp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        signal: AbortSignal.timeout(15_000),
      })

      const data = await toolsResp.json() as { result?: { tools?: MCPToolSchema[] }; error?: { message: string } }
      if (data.error) return { ok: false, tools: [], error: data.error.message }

      const tools = data.result?.tools ?? []
      const session: McpSession = {
        serverId,
        config,
        tools,
        connected: true,
        nextRequestId: 3,
        pendingRequests: new Map(),
      }
      this.sessions.set(serverId, session)
      return { ok: true, tools }
    } catch (err) {
      return { ok: false, tools: [], error: (err as Error).message }
    }
  }

  public async callTool(serverId: string, toolName: string, args: unknown, config?: Record<string, unknown>): Promise<unknown> {
    let session = this.sessions.get(serverId)
    if (!session || !session.connected) {
      if (!config) throw new Error(`El servidor MCP "${serverId}" no está conectado y no hay configuración disponible.`)
      const conn = await this.ensureConnected(config)
      if (!conn.ok) throw new Error(`No se pudo conectar al servidor MCP "${serverId}": ${conn.error}`)
      session = this.sessions.get(serverId)
    }

    if (!session) throw new Error(`Sesión no encontrada para el servidor MCP "${serverId}"`)

    if (session.proc && !session.proc.killed) {
      const result = await this.sendRequest(session, 'tools/call', {
        name: toolName,
        arguments: args ?? {},
      })
      return result
    }

    if (session.config.type === 'http') {
      const url = session.config.url as string
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(session.config.headers as Record<string, string> ?? {}),
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: session.nextRequestId++,
          method: 'tools/call',
          params: { name: toolName, arguments: args ?? {} },
        }),
        signal: AbortSignal.timeout(60_000),
      })
      const data = await resp.json() as { result?: unknown; error?: { message: string } }
      if (data.error) throw new Error(data.error.message)
      return data.result
    }

    throw new Error(`Servidor MCP "${serverId}" desconectado o no accesible`)
  }

  private sendRequest(session: McpSession, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = session.nextRequestId++
      const timer = setTimeout(() => {
        session.pendingRequests.delete(id)
        reject(new Error(`Timeout de petición MCP (${method}, id: ${id})`))
      }, 60_000)

      session.pendingRequests.set(id, { resolve, reject, timer })

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
      session.proc?.stdin?.write(msg)
    })
  }

  public disconnect(serverId: string): void {
    const session = this.sessions.get(serverId)
    if (!session) return

    for (const pending of session.pendingRequests.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Servidor MCP desconectado'))
    }
    session.pendingRequests.clear()

    if (session.proc && !session.proc.killed) {
      try { session.proc.kill() } catch { /* ignore */ }
    }

    session.connected = false
    this.sessions.delete(serverId)
  }

  public getTools(serverId: string): MCPToolSchema[] {
    return this.sessions.get(serverId)?.tools ?? []
  }
}
