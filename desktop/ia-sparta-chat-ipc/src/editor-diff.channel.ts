import { ipcMain } from 'electron'
import { sendToPython } from 'ia-sparta-ipc-bridge'

export function registerEditorDiffIPC(): void {
  ipcMain.handle('editor:diff_respond', (_event, payload: { requestId: string; approved: boolean }) => {
    sendToPython({
      method: 'permission.respond',
      params: {
        request_id: payload.requestId,
        approved: payload.approved,
        remember: 'once',
      },
    })
    return { ok: true }
  })
}
