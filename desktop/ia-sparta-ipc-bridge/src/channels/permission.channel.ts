/**
 * permission.ipc.ts
 *
 * Handles the bidirectional permission flow between Python sidecar and renderer:
 *
 *   Python → stdout event "permission:request"
 *     └─► sidecar.ipc.ts picks it up via SidecarEvent.MESSAGE
 *     └─► registerPermissionIPC() forwards it to renderer via win.webContents.send
 *
 *   Renderer → ipcRenderer.invoke('permission:respond', { requestId, approved, remember })
 *     └─► permission.ipc.ts receives it
 *     └─► sends { method: 'permission.respond', params: { request_id, approved } } to Python
 */

import { ipcMain, BrowserWindow } from 'electron'
import { sidecarEvents, sendToPython, SidecarEvent } from './sidecar.channel'

export interface PermissionRequestPayload {
  requestId: string
  tool: string
  path: string
  preview: string
}

export interface PermissionResponsePayload {
  requestId: string
  approved: boolean
  /** 'once' | 'session' — passed to Python so it can cache the decision */
  remember: 'once' | 'session'
}

// Track the active BrowserWindow so we can send events to the renderer.
// Updated every time a chat:send IPC call is made (same pattern as chat.ipc.ts).
let _win: BrowserWindow | null = null

export function setPermissionWindow(win: BrowserWindow): void {
  _win = win
}

export function registerPermissionIPC(): void {
  // ── Python → Renderer ──────────────────────────────────────────────────────
  // Listen for permission:request events arriving from the Python sidecar
  // through the existing sidecarEvents EventEmitter.
  sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
    if (msg.event !== 'permission:request') return

    const data = (msg.data ?? {}) as Record<string, unknown>
    const payload: PermissionRequestPayload = {
      requestId: (data.request_id ?? '') as string,
      tool:      (data.tool      ?? '') as string,
      path:      (data.path      ?? '') as string,
      preview:   (data.preview   ?? '') as string,
    }

    const win = _win ?? BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('permission:request', payload)
    }
  })

  // ── Renderer → Python ──────────────────────────────────────────────────────
  // The renderer calls window.electron.invoke('permission:respond', payload)
  // after the user makes a decision in PermissionRequestDialog.
  ipcMain.handle('permission:respond', (_event, payload: PermissionResponsePayload) => {
    sendToPython({
      method: 'permission.respond',
      params: {
        request_id: payload.requestId,
        approved:   payload.approved,
        remember:   payload.remember,
      },
    })
    return { ok: true }
  })
}
