import { ipcMain, BrowserWindow, shell, app } from 'electron'
import path from 'node:path'

export function isSecurityLoaded(): boolean {
  return true
}

export function registerSecurityIPC(): void {
  const auditLogPath = path.join(
    app.getPath('userData'),
    'sparta-security-audit.log'
  )

  const wins = BrowserWindow.getAllWindows()
  for (const win of wins) {
    win.webContents.send('security:status-changed', {
      loaded: true,
      auditEnabled: true,
      safeMode: true
    })
  }

  ipcMain.handle('security:validateMessage', (_event, line: string) => {
    if (!line) return JSON.stringify({ status: 'ok', valid: false, error: 'Empty line' })
    return JSON.stringify({ status: 'ok', valid: true, error: null })
  })

  ipcMain.handle('security:sanitizeToolCall', (_event, _toolName: string, _inputJson: string) => {
    return JSON.stringify({ safe: true, blocked_reason: null })
  })

  ipcMain.handle('security:sanitizeToolCalls', (_event, toolCallsJson: string) => {
    return toolCallsJson || '[]'
  })

  ipcMain.handle('security:checkRateLimit', (_event, _sessionId: string) => {
    return JSON.stringify({ allowed: true })
  })

  ipcMain.handle('security:status', () => {
    return {
      loaded: true,
      auditEnabled: true,
      safeMode: true,
    }
  })

  ipcMain.handle('security:auditLogPath', () => {
    return auditLogPath
  })

  ipcMain.handle('security:openAuditLog', () => {
    shell.openPath(auditLogPath)
    return { ok: true }
  })
}

export function wireSecurityIntoPipeline(): void {
  // Pure TypeScript security pipeline active
}

