import { BrowserWindow } from 'electron'
import { sendToPython, sidecarEvents, SidecarEvent } from 'ia-sparta-ipc-bridge'
import { storeKey as vaultStoreKey } from 'ia-sparta-vault'
import {
  activeStreams,
  windowBySession,
  getNextSeq,
  clearSeqCounters,
  sendToRenderer,
  streamResolvers,
} from './shared'

export function registerOnMessageHandler(): void {
  const onMessage = (msg: Record<string, unknown>) => {
    const requestId = (msg.id as string) ?? ''
    const [sessionId, messageId] = requestId.split(':')

    const event = msg.event as string
    const data = msg.data as Record<string, unknown> | undefined

    // The renderer can stop immediately, while some provider clients need a
    // moment to observe cancellation. Never let delayed tokens resurrect a
    // response the user explicitly stopped.
    const activeStream = sessionId ? activeStreams.get(sessionId) : undefined
    const isLateStreamEvent = Boolean(
      sessionId && messageId &&
      (!activeStream || !activeStream.active || activeStream.messageId !== messageId) &&
      (event.startsWith('stream:') || event.startsWith('thinking:') || event.startsWith('tool:') || event === 'search:progress'),
    )
    if (isLateStreamEvent) return

    if (event === 'vault:mcp_store') {
      const keyId = (data?.key_id ?? '') as string
      const value = (data?.value ?? '') as string
      if (keyId && value) {
        vaultStoreKey(keyId, value, 'mcp')
      }
      sendToPython({ id: msg.id ?? '', method: 'keymanager.set', params: { key_id: keyId, value } })
      return
    }

    if (event === 'mcp:connected' || event === 'mcp:tool_discovered' || event === 'mcp:error') {
      const win = (sessionId ? windowBySession.get(sessionId) : undefined)
        ?? BrowserWindow.getFocusedWindow()
        ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          ...(data ?? {}),
        })
      }
      return
    }

    if ((!sessionId || !messageId) && event === 'search:progress') {
      for (const [sid, stream] of activeStreams.entries()) {
        if (stream.active) {
          const fallbackId = `${sid}:${stream.messageId}`
          const [s, m] = fallbackId.split(':')
          sendToRenderer({ sessionId: s, messageId: m, type: 'search:progress', ...((data ?? {}) as Record<string, unknown>) })
          return
        }
      }
    }

    if (event === 'terminal:agent_output' || event === 'terminal:agent_exit' || event === 'terminal:tool_crash') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          ...(data ?? {}),
        })
      }
      return
    }

    if (event === 'editor:diff_proposed') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'editor:diff_proposed',
          requestId: data?.request_id ?? '',
          filePath: data?.file_path ?? '',
          originalContent: data?.original_content ?? '',
          newContent: data?.new_content ?? '',
          language: data?.language ?? '',
          timestamp: Date.now(),
        })
      }
      return
    }

    if (event === 'file:changed') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'file:changed',
          path: data?.path ?? '',
        })
      }
      return
    }

    if (event === 'plan:created' || event === 'plan:step') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: event,
          plan: data?.plan,
          currentStep: data?.current_step ?? data?.currentStep ?? 0,
          planComplete: data?.plan_complete ?? data?.planComplete ?? false,
          ns: data?.ns,
        })
      }
      return
    }

    if (event === 'workspace:connected') {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('sparta:event', {
          type: 'workspace:connected',
          root: data?.root ?? '',
        })
      }
      return
    }

    if (!sessionId || !messageId) return

    switch (event) {
      case 'thinking:started':
        sendToRenderer({ sessionId, messageId, type: 'thinking:started', origin: data?.origin ?? 'native' })
        break
      case 'thinking:token':
        sendToRenderer({ sessionId, messageId, type: 'thinking:token', token: data?.token, chunkSeq: data?.chunkSeq ?? getNextSeq(requestId, 'think'), origin: data?.origin ?? 'native' })
        break
      case 'thinking:completed':
        sendToRenderer({ sessionId, messageId, type: 'thinking:completed', tokensUsed: data?.tokens_used ?? data?.tokensUsed ?? 0 })
        break
      case 'thinking:status':
        sendToRenderer({ sessionId, messageId, type: 'thinking:status', text: data?.text ?? '' })
        break
      case 'reasoning:token':
        sendToRenderer({ sessionId, messageId, type: 'reasoning:token', token: data?.token ?? '' })
        break
      case 'reasoning:available':
        sendToRenderer({ sessionId, messageId, type: 'reasoning:available', text: data?.text ?? '' })
        break
      case 'stream:token':
        sendToRenderer({ sessionId, messageId, type: 'stream:token', token: data?.token, chunkSeq: data?.chunkSeq ?? getNextSeq(requestId, 'stream') })
        break
      case 'stream:degenerate': {
        sendToRenderer({
          sessionId, messageId,
          type: 'stream:error',
          error: 'La respuesta se cortó por repetición detectada. El texto generado hasta el corte se conserva. Probá con otro modelo o reintentá.',
        })
        clearSeqCounters(requestId)
        const resolveDeg = streamResolvers.get(requestId)
        resolveDeg?.()
        streamResolvers.delete(requestId)
        break
      }
      case 'stream:completed': {
        sendToRenderer({
          sessionId, messageId, type: 'stream:completed',
          usage: data?.usage,
          suggestions: data?.suggestions,
        })
        clearSeqCounters(requestId)
        const resolveCompleted = streamResolvers.get(requestId)
        resolveCompleted?.()
        streamResolvers.delete(requestId)
        break
      }
      case 'stream:aborted':
        sendToRenderer({ sessionId, messageId, type: 'stream:aborted' })
        clearSeqCounters(requestId)
        activeStreams.delete(sessionId)
        const resolveAborted = streamResolvers.get(requestId)
        resolveAborted?.()
        streamResolvers.delete(requestId)
        break
      case 'terminal:agent_command':
        sendToRenderer({ sessionId, messageId, type: 'terminal:agent_command', command: data?.command })
        break
      case 'terminal:agent_spawn':
        sendToRenderer({ sessionId, messageId, type: 'terminal:agent_spawn', procId: data?.procId, command: data?.command, label: data?.label })
        break
      case 'search:progress':
        sendToRenderer({
          sessionId,
          messageId,
          type: 'search:progress',
          stage: data?.stage,
          query: data?.query,
          tool_call_id: data?.tool_call_id ?? data?.toolCallId,
          url: data?.url,
          title: data?.title,
          index: data?.index,
          total: data?.total,
          tool: data?.tool,
          filePath: data?.file_path ?? data?.filePath,
          progress: data?.progress,
          matchesFound: data?.matches_found ?? data?.matchesFound,
        })
        break
      case 'search:completed':
        sendToRenderer({
          sessionId,
          messageId,
          type: 'search:completed',
          totalMatches: data?.total_matches ?? data?.totalMatches ?? 0,
          filesSearched: data?.files_searched ?? data?.filesSearched ?? 0,
        })
        break
      case 'stream:cancelled':
        sendToRenderer({ sessionId, messageId, type: 'stream:cancelled' })
        clearSeqCounters(requestId)
        break
      case 'stream:error': {
        const errorMsg = typeof data?.error === 'string'
          ? data.error
          : (data?.error as Record<string, unknown>)?.message
            ?? 'Error desconocido del sidecar'
        sendToRenderer({ sessionId, messageId, type: 'stream:error', error: errorMsg })
        clearSeqCounters(requestId)
        const resolveErr = streamResolvers.get(requestId)
        resolveErr?.()
        streamResolvers.delete(requestId)
        break
      }
      default:
        sendToRenderer({ sessionId, messageId, type: event, ...(data ?? {}) })
        break
    }
  }

  sidecarEvents.on(SidecarEvent.MESSAGE, onMessage)
}
