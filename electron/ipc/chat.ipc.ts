import { ipcMain, BrowserWindow } from 'electron'

interface ChatRequest {
  sessionId: string
  messageId: string
  model: string
  messages: { role: string; content: string }[]
  providerKey?: string
  apiUrl?: string
  isLocal?: boolean
  system?: string
}

const activeStreams = new Map<string, AbortController>()

function getEndpoint(apiUrl?: string, isLocal?: boolean): string {
  if (apiUrl) {
    const base = apiUrl.replace(/\/+$/, '')
    if (isLocal) {
      if (base.includes('/api/chat')) return `${base}`
      if (base.includes('/v1')) return `${base}/chat/completions`
      return `${base}/v1/chat/completions`
    }
    return `${base}/v1/chat/completions`
  }
  return 'https://api.openai.com/v1/chat/completions'
}

function getHeaders(providerKey: string, apiUrl?: string, isLocal?: boolean): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (isLocal) return headers
  if (apiUrl?.includes('anthropic')) {
    headers['x-api-key'] = providerKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (apiUrl?.includes('google')) {
    // Google uses query param key
  } else {
    headers['Authorization'] = `Bearer ${providerKey}`
  }
  return headers
}

export function registerChatIPC() {
  ipcMain.handle('chat:send', async (_event, req: ChatRequest) => {
    const { providerKey, sessionId, messageId, apiUrl, isLocal } = req
    if (!providerKey && !isLocal) return { ok: false, error: 'No provider configured' }

    const abortController = new AbortController()
    activeStreams.set(sessionId, abortController)

    const win = BrowserWindow.getFocusedWindow()
    function sendChunk(chunk: Record<string, unknown>) {
      win?.webContents.send('sparta:event', { sessionId, messageId, ...chunk })
    }

    try {
      const endpoint = getEndpoint(apiUrl, isLocal)
      const headers = getHeaders(providerKey ?? '', apiUrl, isLocal)

      let body: string
      if (apiUrl?.includes('anthropic')) {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: 4096,
          stream: true,
        })
      } else if (isLocal && apiUrl?.includes('/api/chat')) {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
        })
      } else {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          max_tokens: 4096,
        })
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: abortController.signal,
      })

      if (!response.ok) {
        sendChunk({ type: 'error', error: `HTTP ${response.status}` })
        return { ok: false, error: `HTTP ${response.status}` }
      }

      const reader = response.body?.getReader()
      if (!reader) {
        sendChunk({ type: 'error', error: 'No response body' })
        return { ok: false, error: 'No response body' }
      }

      const decoder = new TextDecoder()
      let buffer = ''

      let streaming = true
      while (streaming) {
        const { done, value } = await reader.read()
        if (done) streaming = false

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const json = trimmed.slice(5).trim()
          if (json === '[DONE]') {
            sendChunk({ type: 'done' })
            continue
          }
          try {
            const parsed = JSON.parse(json)
            if (apiUrl?.includes('anthropic')) {
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                sendChunk({ type: 'content_token', delta: parsed.delta.text })
              }
            } else {
              const choice = parsed.choices?.[0]
              if (choice?.delta?.content) {
                sendChunk({ type: 'content_token', delta: choice.delta.content })
              }
              if (choice?.delta?.reasoning_content) {
                sendChunk({ type: 'thinking_token', delta: choice.delta.reasoning_content })
              }
              if (choice?.finish_reason === 'stop') {
                sendChunk({ type: 'done' })
              }
            }
          } catch { /* skip parse errors */ }
        }
      }

      sendChunk({ type: 'done' })
      return { ok: true }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        sendChunk({ type: 'done' })
        return { ok: true, aborted: true }
      }
      sendChunk({ type: 'error', error: (err as Error).message })
      return { ok: false, error: (err as Error).message }
    } finally {
      activeStreams.delete(sessionId)
    }
  })

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    const controller = activeStreams.get(sessionId)
    if (controller) {
      controller.abort()
      activeStreams.delete(sessionId)
    }
  })
}
