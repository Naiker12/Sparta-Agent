import { sidecarEvents, SidecarEvent } from '../sidecar.ipc'
import {
  activeStreams,
  chunkSeqCounters,
  streamResolvers,
  sendToRenderer,
} from './shared'
import { registerOnMessageHandler } from './on-message'
import { registerChatSendIPC } from './send.ipc'
import { registerAgentTaskIPC } from './agent-task.ipc'
import { registerMcpTestIPC } from './mcp-test.ipc'
import { registerEditorDiffIPC } from './editor-diff.ipc'
import { registerSidecarStatusIPC } from './sidecar-status.ipc'
import { registerMemoryIPC } from './memory.ipc'
import { registerAudioIPC } from './audio.ipc'

export function registerChatIPC(): void {
  sidecarEvents.on(SidecarEvent.STDERR, (text: string) => {
    sendToRenderer({ type: 'sidecar:log', level: 'stderr', text })
  })

  sidecarEvents.on(SidecarEvent.CRASHED, ({ code, signal, attempt }) => {
    for (const [sessionId, { active, messageId }] of activeStreams.entries()) {
      if (active) {
        sendToRenderer({
          sessionId,
          messageId,
          type: 'stream:error',
          error: `El sidecar de Python se ha detenido (código ${code}, señal ${signal}). Intento ${attempt}.`,
        })
        activeStreams.set(sessionId, { active: false, messageId })
      }
    }
    for (const [requestId] of streamResolvers.entries()) {
      const resolve = streamResolvers.get(requestId)
      resolve?.()
      streamResolvers.delete(requestId)
    }
    chunkSeqCounters.clear()
  })

  registerOnMessageHandler()
  registerChatSendIPC()
  registerAgentTaskIPC()
  registerMcpTestIPC()
  registerEditorDiffIPC()
  registerSidecarStatusIPC()
  registerMemoryIPC()
  registerAudioIPC()
}

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  const event = msg.event as string
  if (event === 'stream:completed' || event === 'stream_end' || event === 'error') {
    const requestId = (msg.id as string) ?? ''
    const resolve = streamResolvers.get(requestId)
    resolve?.()
    streamResolvers.delete(requestId)
  }
})
