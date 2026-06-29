import { ipcMain } from 'electron'
import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import { sidecarEvents, SidecarEvent } from './sidecar.ipc'

const require = createRequire(import.meta.url)

type SecurityModule = {
  validateMessage: (line: string) => string
  sanitizeToolCall: (toolName: string, inputJson: string) => string
  sanitizeToolCalls: (toolCallsJson: string) => string
  checkRateLimit: (sessionId: string) => string
  validateToolCallCount: (count: number) => string
  configureAuditLog: (path: string) => void
  auditLogToolCall: (sessionId: string, messageId: string, toolName: string, inputJson: string, blocked: boolean) => void
  auditLogSecurity: (eventType: string, sessionId: string, action: string, details: string) => void
  isAuditEnabled: () => boolean
}

let security: SecurityModule | null = null

function getSecurityModuleRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'rust', 'sparta-security')
    : path.join(process.cwd(), 'rust', 'sparta-security')
}

function loadSecurityModule(): SecurityModule | null {
  if (security) return security

  try {
    const platform = process.platform
    const arch = process.arch
    const ext =
      platform === 'win32' ? 'win32-x64-msvc' :
      platform === 'darwin' && arch === 'arm64' ? 'darwin-arm64' :
      platform === 'darwin' ? 'darwin-x64' :
      platform === 'linux' ? 'linux-x64-gnu' :
      'darwin-x64'
    const modulePath = path.join(
      getSecurityModuleRoot(),
      `sparta-security.${ext}.node`
    )
    security = require(modulePath) as SecurityModule
    console.log('[security] Rust native module loaded')
    return security
  } catch (err) {
    console.warn('[security] Rust module not available, running insecurely:', (err as Error).message)
    return null
  }
}

export function registerSecurityIPC(): void {
  const mod = loadSecurityModule()

  if (mod) {
    const auditLogPath = path.join(
      app.getPath('userData'),
      'sparta-security-audit.log'
    )
    mod.configureAuditLog(auditLogPath)
    console.log(`[security] Audit log: ${auditLogPath}`)
  }

  ipcMain.handle('security:validateMessage', (_event, line: string) => {
    if (!mod) return JSON.stringify({ status: 'ok', valid: true, error: null, skipped: true })
    return mod.validateMessage(line)
  })

  ipcMain.handle('security:sanitizeToolCall', (_event, toolName: string, inputJson: string) => {
    if (!mod) return JSON.stringify({ safe: true, blocked_reason: null, skipped: true })
    return mod.sanitizeToolCall(toolName, inputJson)
  })

  ipcMain.handle('security:sanitizeToolCalls', (_event, toolCallsJson: string) => {
    if (!mod) return '[]'
    return mod.sanitizeToolCalls(toolCallsJson)
  })

  ipcMain.handle('security:checkRateLimit', (_event, sessionId: string) => {
    if (!mod) return JSON.stringify({ allowed: true, skipped: true })
    return mod.checkRateLimit(sessionId)
  })

  ipcMain.handle('security:status', () => {
    return {
      loaded: mod !== null,
      auditEnabled: mod?.isAuditEnabled() ?? false,
    }
  })
}

// Hook into sidecar message pipeline to validate all IPC traffic
export function wireSecurityIntoPipeline(): void {
  const mod = loadSecurityModule()
  if (!mod) return

  const originalEmit = sidecarEvents.emit.bind(sidecarEvents)

  sidecarEvents.emit = (event: string | symbol, ...args: unknown[]) => {
    if (event === SidecarEvent.MESSAGE && args[0]) {
      const msg = args[0] as Record<string, unknown>
      const raw = JSON.stringify(msg)

      // Validate incoming Python messages
      try {
        const result = JSON.parse(mod.validateMessage(raw))
        if (!result.valid && result.error) {
          // Log security event for invalid messages but don't block (pass-through)
          mod.auditLogSecurity(
            'validation_warning',
            (msg.id as string) ?? 'unknown',
            'validate_response',
            result.error as string
          )
        }
      } catch { /* ignore parse errors */ }
    }
    return originalEmit(event, ...args)
  }

  console.log('[security] Pipeline hook active')
}
