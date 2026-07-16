import { ipcMain } from 'electron'
import { sendToPython, isSidecarRunning, waitForSidecarReady, sidecarEvents, SidecarEvent } from 'ia-sparta-ipc-bridge'

const audioResolvers = new Map<string, (result: unknown) => void>()

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  const event = msg.event as string
  if (event === 'audio.transcribe:response') {
    const resolver = audioResolvers.get((msg.id as string) ?? '')
    if (resolver) {
      resolver(msg.data ?? { error: 'Sin respuesta del sidecar' })
      audioResolvers.delete((msg.id as string) ?? '')
    }
  }
})

export function registerAudioIPC(): void {
  ipcMain.handle('audio:transcribe', async (_event, { audio, filename, language }: { audio: string; filename: string; language?: string }) => {
    if (!isSidecarRunning()) {
      return { error: 'Sidecar no iniciado' }
    }
    const ready = await waitForSidecarReady(10_000)
    if (!ready) {
      return { error: 'Sidecar no listo' }
    }
    const requestId = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sendToPython({
      id: requestId,
      method: 'audio.transcribe',
      params: { audio, filename, language: language ?? 'es' },
    })
    return new Promise((resolve) => {
      audioResolvers.set(requestId, resolve)
      setTimeout(() => {
        if (audioResolvers.has(requestId)) {
          audioResolvers.delete(requestId)
          resolve({ error: 'Timeout esperando transcripción del sidecar' })
        }
      }, 30_000)
    })
  })
}
